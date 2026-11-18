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
const DEFAULT_REDIRECT = 'https://otya.site/api/auth/telegram/callback'
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
  if (!env.TELEGRAM_LOGIN_CLIENT_ID || !env.TELEGRAM_LOGIN_CLIENT_SECRET) {
    return json({ error: 'Telegram Sign-In is temporarily unavailable', code: 'TELEGRAM_LOGIN_UNAVAILABLE' }, 503)
  }

  const state = randomUrlSafe(24)
  const verifier = randomUrlSafe(48)
  const nonce = randomUrlSafe(24)
  const challenge = await sha256Base64Url(verifier)
  await env.AUTH_KV.put(`${STATE_PREFIX}${state}`, JSON.stringify({ verifier, nonce } satisfies State), { expirationTtl: STATE_TTL })

  const authorization = new URL(AUTH_URL)
  authorization.searchParams.set('client_id', env.TELEGRAM_LOGIN_CLIENT_ID)
  authorization.searchParams.set('redirect_uri', env.TELEGRAM_LOGIN_REDIRECT_URI || DEFAULT_REDIRECT)
  authorization.searchParams.set('response_type', 'code')
  authorization.searchParams.set('scope', 'openid profile phone')
  authorization.searchParams.set('state', state)
  authorization.searchParams.set('nonce', nonce)
  authorization.searchParams.set('code_challenge', challenge)
  authorization.searchParams.set('code_challenge_method', 'S256')
  return json({ ok: true, mode: 'login', provider_mode: 'oidc', authorization_url: authorization.toString() })
}

async function callback(request: Request, env: TelegramPrimaryLoginEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/auth/telegram/callback') return null
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const state = url.searchParams.get('state') || ''
  const code = url.searchParams.get('code') || ''
  if (!state || !code) return null

  const key = `${STATE_PREFIX}${state}`
  const raw = await env.AUTH_KV.get(key)
  if (!raw) return null
  await env.AUTH_KV.delete(key)

  try {
    const stored = JSON.parse(raw) as State
    if (!stored.verifier || !stored.nonce) throw new Error('Incomplete Telegram state')
    if (!env.TELEGRAM_LOGIN_CLIENT_ID || !env.TELEGRAM_LOGIN_CLIENT_SECRET) throw new Error('Telegram provider unavailable')
    const redirectUri = env.TELEGRAM_LOGIN_REDIRECT_URI || DEFAULT_REDIRECT
    const basic = btoa(`${env.TELEGRAM_LOGIN_CLIENT_ID}:${env.TELEGRAM_LOGIN_CLIENT_SECRET}`)
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: env.TELEGRAM_LOGIN_CLIENT_ID,
        code_verifier: stored.verifier,
      }).toString(),
      signal: AbortSignal.timeout(8000),
    })
    const token = await tokenResponse.json().catch(() => ({})) as { id_token?: string }
    if (!tokenResponse.ok || !token.id_token) throw new Error('Telegram token exchange failed')

    const claims = await verifyIdToken(token.id_token, env.TELEGRAM_LOGIN_CLIENT_ID, stored.nonce)
    await assertSchemaReady(env.AUTH_DB)
    const user = await createOrGetTelegramUser(env, claims.sub!, claims.preferred_username, claims.name)
    await applyVerifiedPhone(env, user.id, claims)
    const session = await issueSession(env, user)

    return json({
      ok: true,
      telegram_login: true,
      created_or_logged_in: true,
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      expires_in: ACCESS_TTL,
      token_type: 'Bearer',
      user: {
        id: user.id,
        otya_id: user.otya_id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
      },
    })
  } catch (error) {
    console.error('[telegram-primary-login]', (error as Error)?.message)
    return Response.redirect('https://otya.site/sign-in?telegram=error', 302)
  }
}

export async function handleTelegramPrimaryLogin(request: Request, env: TelegramPrimaryLoginEnv): Promise<Response | null> {
  const started = await start(request, env)
  if (started) return started
  return callback(request, env)
}
