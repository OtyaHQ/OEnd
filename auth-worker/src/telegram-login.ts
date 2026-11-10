import { generateRefreshToken, signJwt, verifyJwt } from './crypto'
import { assertSchemaReady, getUserById, type D1Database, type UserRow } from './db'
import { adminTelegramPending, markAdminTelegramComplete } from './admin-mfa'

interface KVNamespaceLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export interface TelegramLoginEnv {
  AUTH_DB: D1Database
  AUTH_KV: KVNamespaceLike
  AUTH_JWT_SECRET: string
  TELEGRAM_LOGIN_CLIENT_ID?: string
  TELEGRAM_LOGIN_CLIENT_SECRET?: string
  TELEGRAM_LOGIN_REDIRECT_URI?: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_LOGIN_BOT_USERNAME?: string
  ADMIN_EMAILS?: string
}

type TelegramClaims = {
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

type JoseWebKey = JsonWebKey & { kid?: string }
type TelegramMode = 'login' | 'link' | 'admin'
type StoredTelegramState = {
  mode: TelegramMode
  userId?: string
  verifier?: string
  nonce?: string
}

type TelegramWidgetPayload = {
  id: string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: string
  hash: string
}

const OIDC_AUTH = 'https://oauth.telegram.org/auth'
const OIDC_TOKEN = 'https://oauth.telegram.org/token'
const OIDC_JWKS = 'https://oauth.telegram.org/.well-known/jwks.json'
const DEFAULT_REDIRECT = 'https://petersmartlink.com/api/auth/telegram/callback'
const DEFAULT_WIDGET_REDIRECT = 'https://petersmartlink.com/api/auth/telegram/widget/callback'
const STATE_TTL = 10 * 60
const ACCESS_TOKEN_TTL_SECS = 15 * 60
const REFRESH_TOKEN_TTL_SECS = 30 * 24 * 60 * 60

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
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function requireUser(request: Request, env: TelegramLoginEnv): Promise<string | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = await verifyJwt(auth.slice(7), env.AUTH_JWT_SECRET)
  return payload?.sub ?? null
}

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null
  const compact = raw.replace(/[\s()-]/g, '')
  const normalized = compact.startsWith('+') ? compact : `+${compact}`
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null
}

async function validateIdToken(idToken: string, clientId: string, nonce: string): Promise<TelegramClaims> {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('Malformed Telegram ID token')
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]))) as { alg?: string; kid?: string }
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))) as TelegramClaims
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Telegram token algorithm')

  const jwksResponse = await fetch(OIDC_JWKS, { headers: { Accept: 'application/json' } })
  if (!jwksResponse.ok) throw new Error('Telegram keys unavailable')
  const jwks = await jwksResponse.json() as { keys?: JoseWebKey[] }
  const jwk = (jwks.keys ?? []).find(key => key.kid === header.kid)
  if (!jwk) throw new Error('Telegram signing key not found')

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  )
  if (!valid) throw new Error('Invalid Telegram token signature')

  const now = Math.floor(Date.now() / 1000)
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (claims.iss !== 'https://oauth.telegram.org') throw new Error('Invalid Telegram token issuer')
  if (!audience.includes(clientId)) throw new Error('Invalid Telegram token audience')
  if (!claims.exp || claims.exp <= now) throw new Error('Expired Telegram token')
  if (!claims.sub) throw new Error('Telegram subject missing')
  if (claims.nonce !== nonce) throw new Error('Telegram nonce mismatch')
  return claims
}

function hexToBytes(value: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Invalid Telegram widget signature')
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function validateWidgetPayload(url: URL, botToken: string): Promise<TelegramWidgetPayload> {
  const values = new Map<string, string>()
  for (const [key, value] of url.searchParams.entries()) {
    if (key !== 'hash' && key !== 'state' && value) values.set(key, value)
  }
  const hash = url.searchParams.get('hash') || ''
  const authDate = values.get('auth_date') || ''
  const id = values.get('id') || ''
  if (!hash || !authDate || !/^\d+$/.test(id)) throw new Error('Incomplete Telegram widget response')

  const timestamp = Number(authDate)
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isSafeInteger(timestamp) || timestamp > now + 60 || timestamp < now - STATE_TTL) {
    throw new Error('Expired Telegram widget response')
  }

  const dataCheckString = [...values.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secret = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(botToken))
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    hexToBytes(hash),
    new TextEncoder().encode(dataCheckString),
  )
  if (!valid) throw new Error('Invalid Telegram widget signature')

  return {
    id,
    auth_date: authDate,
    hash,
    first_name: values.get('first_name'),
    last_name: values.get('last_name'),
    username: values.get('username'),
    photo_url: values.get('photo_url'),
  }
}

async function issueBrowserTokens(user: UserRow, env: TelegramLoginEnv) {
  const now = Math.floor(Date.now() / 1000)
  const accessToken = await signJwt({
    sub: user.id,
    email: user.email,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECS,
  }, env.AUTH_JWT_SECRET)
  const refreshToken = generateRefreshToken()
  await env.AUTH_KV.put(`rt:${refreshToken}`, user.id, { expirationTtl: REFRESH_TOKEN_TTL_SECS })
  await env.AUTH_KV.put(`rt_user:${user.id}:${refreshToken}`, '1', { expirationTtl: REFRESH_TOKEN_TTL_SECS })
  return { accessToken, refreshToken }
}

async function applyVerifiedPhone(env: TelegramLoginEnv, userId: string, claims: TelegramClaims): Promise<string | null> {
  const phone = claims.phone_number_verified === true ? normalizePhone(claims.phone_number) : null
  if (!phone) return null
  const owner = await env.AUTH_DB.prepare('SELECT id FROM users WHERE phone_number = ? AND id <> ? LIMIT 1').bind(phone, userId).first<{ id: string }>()
  if (owner) return null
  await env.AUTH_DB.prepare(`
    UPDATE users SET
      phone_number = ?,
      phone_verified_at = datetime('now'),
      phone_verification_method = 'telegram_oidc',
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(phone, userId).run()
  return phone
}

async function completeTelegramIdentity(
  env: TelegramLoginEnv,
  stored: StoredTelegramState,
  providerSubject: string,
  providerUsername?: string,
  claims?: TelegramClaims,
): Promise<Response> {
  if (stored.mode === 'login') {
    return Response.redirect('https://petersmartlink.com/sign-in?telegram=disabled', 302)
  }
  const existingIdentity = await env.AUTH_DB.prepare(
    'SELECT user_id FROM linked_identities WHERE provider = ? AND provider_subject = ? LIMIT 1',
  ).bind('telegram', providerSubject).first<{ user_id: string }>()

  if (stored.mode === 'login') {
    if (!existingIdentity?.user_id) {
      return Response.redirect('https://petersmartlink.com/sign-in?telegram=not-linked', 302)
    }
    const user = await getUserById(env.AUTH_DB, existingIdentity.user_id)
    if (!user) return Response.redirect('https://petersmartlink.com/sign-in?telegram=account-missing', 302)
    await env.AUTH_DB.prepare(
      `UPDATE linked_identities SET provider_username = ?, last_used_at = datetime('now') WHERE provider = 'telegram' AND provider_subject = ?`,
    ).bind(providerUsername ?? null, providerSubject).run()
    if (claims) await applyVerifiedPhone(env, user.id, claims)
    const tokens = await issueBrowserTokens(user, env)
    return json({
      ok: true,
      telegram_login: true,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        otya_id: user.otya_id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
      },
    })
  }

  const userId = stored.userId
  if (!userId) throw new Error('Telegram state is missing the OTYA account')
  if (existingIdentity && existingIdentity.user_id !== userId) throw new Error('This Telegram account is already linked to another OTYA account')

  if (stored.mode === 'admin') {
    if (!existingIdentity || existingIdentity.user_id !== userId) {
      return Response.redirect('https://petersmartlink.com/admin?telegram=not-linked', 302)
    }
    const user = await getUserById(env.AUTH_DB, userId)
    if (!user) return Response.redirect('https://petersmartlink.com/admin?telegram=account-missing', 302)
    await env.AUTH_DB.prepare(
      `UPDATE linked_identities SET provider_username = ?, last_used_at = datetime('now') WHERE provider = 'telegram' AND provider_subject = ?`,
    ).bind(providerUsername ?? null, providerSubject).run()
    if (claims) await applyVerifiedPhone(env, user.id, claims)
    await markAdminTelegramComplete(env, userId)
    return json({
      ok: true,
      telegram_login: true,
      admin_mfa: true,
      user: {
        id: user.id,
        otya_id: user.otya_id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
      },
    })
  }

  await env.AUTH_DB.prepare(`
    INSERT INTO linked_identities (user_id, provider, provider_subject, provider_username)
    VALUES (?, 'telegram', ?, ?)
    ON CONFLICT(user_id, provider) DO UPDATE SET
      provider_subject = excluded.provider_subject,
      provider_username = excluded.provider_username,
      last_used_at = datetime('now')
  `).bind(userId, providerSubject, providerUsername ?? null).run()

  const phone = claims ? await applyVerifiedPhone(env, userId, claims) : null
  return Response.redirect(`https://petersmartlink.com/account?telegram=${phone ? 'verified' : 'linked'}`, 302)
}

export async function handleTelegramLogin(request: Request, env: TelegramLoginEnv): Promise<Response | null> {
  const url = new URL(request.url)
  const isStart = url.pathname === '/auth/telegram/start'
  const isOidcCallback = url.pathname === '/auth/telegram/callback'
  const isWidgetCallback = url.pathname === '/auth/telegram/widget/callback'
  if (!isStart && !isOidcCallback && !isWidgetCallback) return null

  const oidcConfigured = Boolean(env.TELEGRAM_LOGIN_CLIENT_ID && env.TELEGRAM_LOGIN_CLIENT_SECRET)
  const widgetConfigured = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_LOGIN_BOT_USERNAME)
  if (!oidcConfigured && !widgetConfigured) {
    return json({ error: 'Telegram Sign-In is not configured yet', code: 'TELEGRAM_LOGIN_UNAVAILABLE' }, 503)
  }

  await assertSchemaReady(env.AUTH_DB)

  if (isStart) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const requested = url.searchParams.get('mode')
    if (requested === 'login') {
      return json({
        error: 'Telegram is an Otya security-code channel, not a sign-in method. Use Google or email to sign in.',
        code: 'TELEGRAM_SIGN_IN_DISABLED',
      }, 403)
    }
    const mode: TelegramMode = requested === 'admin' ? 'admin' : 'link'
    const userId = mode === 'login' ? null : await requireUser(request, env)
    if (mode !== 'login' && !userId) return json({ error: 'Sign in to OTYA first' }, 401)
    if (mode === 'admin' && userId && !(await adminTelegramPending(env, userId))) {
      return json({ error: 'Verify your admin email code first.' }, 401)
    }

    if (oidcConfigured) {
      const redirectUri = env.TELEGRAM_LOGIN_REDIRECT_URI || DEFAULT_REDIRECT
      const state = randomUrlSafe(24)
      const verifier = randomUrlSafe(48)
      const nonce = randomUrlSafe(24)
      const challenge = await sha256Base64Url(verifier)
      const stored: StoredTelegramState = { mode, verifier, nonce, ...(userId ? { userId } : {}) }
      await env.AUTH_KV.put(`telegram_oidc:${state}`, JSON.stringify(stored), { expirationTtl: STATE_TTL })

      const authUrl = new URL(OIDC_AUTH)
      authUrl.searchParams.set('client_id', env.TELEGRAM_LOGIN_CLIENT_ID!)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', 'openid profile phone')
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('nonce', nonce)
      authUrl.searchParams.set('code_challenge', challenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      return json({ ok: true, mode, provider_mode: 'oidc', authorization_url: authUrl.toString() })
    }

    const state = randomUrlSafe(24)
    const stored: StoredTelegramState = { mode, ...(userId ? { userId } : {}) }
    await env.AUTH_KV.put(`telegram_widget:${state}`, JSON.stringify(stored), { expirationTtl: STATE_TTL })
    const widgetAuthUrl = new URL(DEFAULT_WIDGET_REDIRECT)
    widgetAuthUrl.searchParams.set('state', state)
    return json({
      ok: true,
      mode,
      provider_mode: 'widget',
      bot_username: env.TELEGRAM_LOGIN_BOT_USERNAME,
      widget_auth_url: widgetAuthUrl.toString(),
    })
  }

  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  if (isWidgetCallback) {
    const state = url.searchParams.get('state') || ''
    if (!state) return Response.redirect('https://petersmartlink.com/sign-in?telegram=expired', 302)
    const storedRaw = await env.AUTH_KV.get(`telegram_widget:${state}`)
    await env.AUTH_KV.delete(`telegram_widget:${state}`)
    if (!storedRaw) return Response.redirect('https://petersmartlink.com/sign-in?telegram=expired', 302)
    try {
      const stored = JSON.parse(storedRaw) as StoredTelegramState
      const payload = await validateWidgetPayload(url, env.TELEGRAM_BOT_TOKEN!)
      return await completeTelegramIdentity(env, stored, payload.id, payload.username)
    } catch (error) {
      console.error('[telegram-widget-login]', (error as Error)?.message)
      return Response.redirect('https://petersmartlink.com/sign-in?telegram=error', 302)
    }
  }

  const state = url.searchParams.get('state') || ''
  const code = url.searchParams.get('code') || ''
  if (!state || !code) return Response.redirect('https://petersmartlink.com/sign-in?telegram=cancelled', 302)

  const storedRaw = await env.AUTH_KV.get(`telegram_oidc:${state}`)
  await env.AUTH_KV.delete(`telegram_oidc:${state}`)
  if (!storedRaw) return Response.redirect('https://petersmartlink.com/sign-in?telegram=expired', 302)

  try {
    const stored = JSON.parse(storedRaw) as StoredTelegramState
    if (!stored.verifier || !stored.nonce) throw new Error('Telegram OIDC state is incomplete')
    const redirectUri = env.TELEGRAM_LOGIN_REDIRECT_URI || DEFAULT_REDIRECT
    const basic = btoa(`${env.TELEGRAM_LOGIN_CLIENT_ID}:${env.TELEGRAM_LOGIN_CLIENT_SECRET}`)
    const tokenResponse = await fetch(OIDC_TOKEN, {
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
        client_id: env.TELEGRAM_LOGIN_CLIENT_ID!,
        code_verifier: stored.verifier,
      }).toString(),
    })
    const tokenData = await tokenResponse.json().catch(() => ({})) as { id_token?: string; error?: string }
    if (!tokenResponse.ok || !tokenData.id_token) throw new Error(tokenData.error || 'Telegram token exchange failed')

    const claims = await validateIdToken(tokenData.id_token, env.TELEGRAM_LOGIN_CLIENT_ID!, stored.nonce)
    return await completeTelegramIdentity(env, stored, claims.sub!, claims.preferred_username, claims)
  } catch (error) {
    console.error('[telegram-login]', (error as Error)?.message)
    return Response.redirect('https://petersmartlink.com/sign-in?telegram=error', 302)
  }
}
