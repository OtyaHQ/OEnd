import { verifyJwt } from './crypto'
import { getUserById, type D1Database } from './db'

interface SecretsStoreSecret {
  get(): Promise<string>
}

export interface TelegramMiniAppEnv {
  AUTH_DB: D1Database
  AUTH_JWT_SECRET: string
  TELEGRAM_BOT_TOKEN?: SecretsStoreSecret
}

type TelegramWebAppUser = {
  id?: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

type VerifiedMiniApp = {
  user: Required<Pick<TelegramWebAppUser, 'id'>> & TelegramWebAppUser
  authDate: number
  queryId?: string
  startParam?: string
}

const MAX_AGE_SECONDS = 10 * 60

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

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false
  const left = new TextEncoder().encode(a.toLowerCase())
  const right = new TextEncoder().encode(b.toLowerCase())
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i]
  return diff === 0
}

async function hmac(keyBytes: BufferSource, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return new Uint8Array(signature)
}

async function botToken(env: TelegramMiniAppEnv): Promise<string> {
  if (!env.TELEGRAM_BOT_TOKEN?.get) throw new Error('Telegram Mini App verification is unavailable')
  const value = await env.TELEGRAM_BOT_TOKEN.get()
  if (!value) throw new Error('Telegram Mini App verification is unavailable')
  return value
}

export async function verifyTelegramInitData(rawInitData: string, env: TelegramMiniAppEnv): Promise<VerifiedMiniApp> {
  if (!rawInitData || rawInitData.length > 12_000) throw new Error('Invalid Telegram Mini App data')
  const params = new URLSearchParams(rawInitData)
  const suppliedHash = params.get('hash') || ''
  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const token = await botToken(env)
  // Telegram Mini Apps: secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
  const secretKey = await hmac(new TextEncoder().encode('WebAppData'), token)
  const calculatedHash = bytesToHex(await hmac(secretKey, dataCheckString))
  if (!constantTimeHexEqual(suppliedHash, calculatedHash)) throw new Error('Invalid Telegram Mini App signature')

  const authDate = Number(params.get('auth_date') || 0)
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isSafeInteger(authDate) || authDate > now + 60 || authDate < now - MAX_AGE_SECONDS) {
    throw new Error('Expired Telegram Mini App data')
  }

  let user: TelegramWebAppUser
  try { user = JSON.parse(params.get('user') || '{}') as TelegramWebAppUser }
  catch { throw new Error('Invalid Telegram Mini App user') }
  if (!Number.isSafeInteger(user.id) || Number(user.id) <= 0) throw new Error('Telegram user ID is required')

  return {
    user: { ...user, id: Number(user.id) },
    authDate,
    queryId: params.get('query_id') || undefined,
    startParam: params.get('start_param') || undefined,
  }
}

async function currentUserId(request: Request, env: TelegramMiniAppEnv): Promise<string | null> {
  const auth = request.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  const payload = await verifyJwt(auth.slice(7), env.AUTH_JWT_SECRET)
  return payload?.sub ?? null
}

export async function handleTelegramMiniApp(request: Request, env: TelegramMiniAppEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/auth/telegram/miniapp') return null
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { initData?: string }
  try { body = await request.json() as { initData?: string } }
  catch { return json({ error: 'Invalid JSON body' }, 400) }

  try { await verifyTelegramInitData(String(body.initData ?? ''), env) }
  catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Telegram Mini App verification failed', code: 'TELEGRAM_MINIAPP_INVALID' }, 401)
  }

  // Telegram Mini App data is a channel assertion only. It must never create
  // an Otya identity or mint an Otya session. The user must already hold a
  // valid Otya session obtained through Google or email/password.
  const userId = await currentUserId(request, env)
  if (!userId) {
    return json({
      error: 'Sign in to your Otya account with Google or email before opening the account-connected Mini App.',
      code: 'OTYA_ACCOUNT_REQUIRED',
    }, 401)
  }

  const user = await getUserById(env.AUTH_DB, userId)
  if (!user) {
    return json({
      error: 'Your Otya session is no longer valid. Sign in again.',
      code: 'OTYA_ACCOUNT_REQUIRED',
    }, 401)
  }

  return json({
    ok: true,
    authenticated: true,
    telegram_verified: true,
    user: {
      id: user.id,
      otya_id: user.otya_id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    },
  })
}
