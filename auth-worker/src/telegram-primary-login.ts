import { generateRefreshToken, signJwt } from './crypto'
import { assertSchemaReady, type D1Database, type UserRow } from './db'
import { createOrGetTelegramUser } from './telegram-account'

interface KVLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export interface TelegramPrimaryLoginEnv {
  AUTH_DB: D1Database
  AUTH_KV: KVLike
  AUTH_JWT_SECRET: string
  TELEGRAM_LOGIN_CLIENT_ID?: string
  TELEGRAM_LOGIN_CLIENT_SECRET?: string
  TELEGRAM_LOGIN_REDIRECT_URI?: string
}

type Claims = {
  iss?: string
  aud?: string | string[]
  sub?: string
  exp?: number
  nonce?: string
  name?: string
  preferred_username?: string
  phone_number?: string
  phone_number_verified?: boolean
}

type State = { verifier: string; nonce: string }
type JoseWebKey = JsonWebKey & { kid?: string }

const AUTH_URL = 'https://oauth.telegram.org/auth'
const TOKEN_URL = 'https://oauth.telegram.org/token'
const JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json'
const DEFAULT_REDIRECT = 'https://petersmartlink.com/api/auth/telegram/callback'
const STATE_PREFIX = 'telegram_primary_oidc:'
const STATE_TTL = 10 * 60
const ACCESS_TTL = 15 * 60
const REFRESH_TTL = 30 * 24 * 60 * 60

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function randomUrlSafe(bytes = 32): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes))
  let binary = ''
  for (const byte of data) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  let binary = ''
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function verifyIdToken(idToken: string, clientId: string, nonce: string): Promise<Claims> {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('Malformed Telegram identity token')
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]))) as { alg?: string; kid?: string }
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))) as Claims
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Telegram identity token')

  const response = await fetch(JWKS_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error('Telegram identity keys unavailable')
  const jwks = await response.json() as { keys?: JoseWebKey[] }
  const jwk = (jwks.keys ?? []).find(key => key.kid === header.kid)
  if (!jwk) throw new Error('Telegram signing key unavailable')

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  )
  if (!valid) throw new Error('Invalid Telegram identity signature')

  const now = Math.floor(Date.now() / 1000)
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (claims.iss !== 'https://oauth.telegram.org') throw new Error('Invalid Telegram issuer')
  if (!audiences.includes(clientId)) throw new Error('Invalid Telegram audience')
  if (!claims.exp || claims.exp <= now) throw new Error('Expired Telegram identity token')
  if (!claims.sub || !/^\d+$/.test(claims.sub)) throw new Error('Invalid Telegram subject')
  if (claims.nonce !== nonce) throw new Error('Telegram nonce mismatch')
  return claims
}

async function applyVerifiedPhone(env: TelegramPrimaryLoginEnv, userId: string, claims: Claims): Promise<void> {
  if (claims.phone_number_verified !== true || !claims.phone_number) return
  const compact = claims.phone_number.replace(/[\s()-]/g, '')
  const phone = compact.startsWith('+') ? compact : `+${compact}`
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return
  const other = await env.AUTH_DB.prepare('SELECT id FROM users WHERE phone_number = ? AND id <> ? LIMIT 1').bind(phone, userId).first<{ id?: string }>()
  if (other?.id) return
  await env.AUTH_DB.prepare(`
    UPDATE users SET phone_number = ?, phone_verified_at = datetime('now'), phone_verification_method = 'telegram_oidc', updated_at = datetime('now')
    WHERE id = ?
  `).bind(phone, userId).run()
}

async function issueSession(env: TelegramPrimaryLoginEnv, user: UserRow) {
  const now = Math.floor(Date.now() / 1000)
  const accessToken = await signJwt({ sub: user.id, email: user.email, iat: now, exp: now + ACCESS_TTL }, env.AUTH_JWT_SECRET)
  const refreshToken = generateRefreshToken()
  await Promise.all([
    env.AUTH_KV.put(`rt:${refreshToken}`, user.id, { expirationTtl: REFRESH_TTL }),
    env.AUTH_KV.put(`rt_user:${user.id}:${refreshToken}`, '1', { expirationTtl: REFRESH_TTL }),
  ])
  return { accessToken, refreshToken }
}

async function start(request: Request, env: TelegramPrimaryLoginEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/auth/telegram/start' || url.searchParams.get('mode') !== 'login') return null
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  return json({
    error: 'Telegram is an Otya security-code channel, not a sign-in method. Use Google or email to sign in.',
    code: 'TELEGRAM_SIGN_IN_DISABLED',
  }, 403)
}

async function callback(request: Request, env: TelegramPrimaryLoginEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/auth/telegram/callback') return null
  const state = url.searchParams.get('state') || ''
  if (!state) return null

  // Discard outstanding primary-login states without issuing an Otya session.
  // The same callback URL remains available to separately authorized owner flows.
  const key = `${STATE_PREFIX}${state}`
  const raw = await env.AUTH_KV.get(key)
  if (!raw) return null
  await env.AUTH_KV.delete(key)
  return Response.redirect('https://petersmartlink.com/sign-in?telegram=disabled', 302)
}

export async function handleTelegramPrimaryLogin(request: Request, env: TelegramPrimaryLoginEnv): Promise<Response | null> {
  const started = await start(request, env)
  if (started) return started
  return callback(request, env)
}
