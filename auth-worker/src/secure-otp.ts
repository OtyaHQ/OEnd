import { generateOtp, hashPassword, verifyJwt } from './crypto'
import { getUserByEmail, getUserById, updatePasswordHash, type D1Database } from './db'
import { sendResendEmail } from './resend'
import { sendLinkedTelegramOtp, type TelegramOtpEnv } from './telegram-otp'

interface KVNamespaceLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[]
    list_complete: boolean
    cursor?: string
  }>
}

export interface SecureOtpEnv extends TelegramOtpEnv {
  AUTH_KV: KVNamespaceLike
  AUTH_JWT_SECRET: string
  RESEND_API_KEY?: string
  OTYA_NO_REPLY_EMAIL?: string
  OTYA_SUPPORT_EMAIL?: string
}

const OTP_TTL = 10 * 60
const SEND_WINDOW_TTL = 60 * 60
const ATTEMPT_TTL = 10 * 60
const MAX_SENDS = 3
const MAX_SENDS_PER_IP = 12
const MAX_ATTEMPTS = 8
const MAX_ATTEMPTS_PER_EMAIL = 16
const CODE_RE = /^[A-Z][0-9]{4}$/
const GENERIC_RESET_MESSAGE = 'If that email exists, a verification code has been sent.'

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

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    ?? 'unknown'
}

async function bump(kv: KVNamespaceLike, key: string, max: number, ttl: number): Promise<boolean> {
  const raw = await kv.get(key)
  const current = raw ? Number.parseInt(raw, 10) : 0
  if (current >= max) return false
  await kv.put(key, String(current + 1), { expirationTtl: ttl })
  return true
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function digestCode(env: SecureOtpEnv, purpose: string, subject: string, code: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.AUTH_JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const normalized = code.trim().toUpperCase()
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`otya-otp:${purpose}:${subject}:${normalized}`),
  )
  return `hmac-sha256:${toHex(new Uint8Array(signature))}`
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return diff === 0
}

async function matchesStoredCode(
  env: SecureOtpEnv,
  stored: string | null,
  purpose: string,
  subject: string,
  supplied: string,
): Promise<boolean> {
  if (!stored || !CODE_RE.test(supplied)) return false
  if (stored.startsWith('hmac-sha256:')) {
    return timingSafeEqual(stored, await digestCode(env, purpose, subject, supplied))
  }
  // One-release compatibility for codes created immediately before this fix.
  return timingSafeEqual(stored.trim().toUpperCase(), supplied)
}

async function requireUser(request: Request, env: SecureOtpEnv) {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = await verifyJwt(auth.slice(7), env.AUTH_JWT_SECRET)
  if (!payload?.sub) return null
  return getUserById(env.AUTH_DB, payload.sub)
}

async function sessionIdForToken(refreshToken: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(refreshToken))
  return toHex(new Uint8Array(digest).slice(0, 16))
}

async function revokeRefreshTokens(env: SecureOtpEnv, userId: string): Promise<void> {
  let cursor: string | undefined
  do {
    const page = await env.AUTH_KV.list({ prefix: `rt_user:${userId}:`, limit: 1000, cursor })
    for (const key of page.keys) {
      const token = key.name.slice(`rt_user:${userId}:`.length)
      const sessionId = await sessionIdForToken(token)
      await Promise.all([
        env.AUTH_KV.delete(key.name),
        env.AUTH_KV.delete(`rt:${token}`),
        env.AUTH_KV.delete(`auth_session:${userId}:${sessionId}`),
        env.AUTH_KV.delete(`auth_session_token:${sessionId}`),
      ])
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
}

function noReplyEmail(env: SecureOtpEnv): string {
  const candidate = env.OTYA_NO_REPLY_EMAIL?.trim() || 'noreply@otya.site'
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : 'noreply@otya.site'
}

async function sendCode(
  env: SecureOtpEnv,
  to: string,
  subject: string,
  intro: string,
  code: string,
  userId?: string,
): Promise<boolean> {
  await sendResendEmail(env.RESEND_API_KEY, {
    from: 'Otya <' + noReplyEmail(env) + '>',
    to: [to],
    replyTo: env.OTYA_SUPPORT_EMAIL?.trim() || 'support@otya.site',
    subject,
    text: [
      intro,
      '',
      code,
      '',
      'This code expires in 10 minutes.',
      'It contains 1 uppercase letter followed by 4 digits.',
      '',
      'If you have linked Telegram to this Otya Account and started the Otya bot, a copy may also be delivered there.',
      'Telegram messages are a delivery channel only. They never sign you in.',
      '',
      'If you did not request this, you can ignore this message.',
      '— The Otya Team',
    ].join('\n'),
  })

  if (!userId) return false
  return sendLinkedTelegramOtp(env, userId, code, subject).catch(() => false)
}

export async function hardenRegistrationVerification(response: Response, env: SecureOtpEnv): Promise<void> {
  if (!response.ok) return
  try {
    const data = await response.clone().json() as { user?: { id?: string } }
    const userId = data.user?.id
    if (!userId) return
    const key = `verify_otp:${userId}`
    const stored = await env.AUTH_KV.get(key)
    if (!stored || stored.startsWith('hmac-sha256:') || !CODE_RE.test(stored.trim().toUpperCase())) return
    await env.AUTH_KV.put(key, await digestCode(env, 'verify-email', userId, stored), { expirationTtl: OTP_TTL })
  } catch (error) {
    console.error('[auth/otp] Could not harden registration code:', (error as Error)?.message)
  }
}

export async function handleSecureOtpRoute(request: Request, env: SecureOtpEnv): Promise<Response | null> {
  const url = new URL(request.url)
  const path = url.pathname
  if (!['/auth/forgot-password', '/auth/reset-password', '/auth/send-verification', '/auth/verify-email'].includes(path)) {
    return null
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (path === '/auth/forgot-password') {
    let body: { email?: string }
    try { body = await request.json() as { email?: string } } catch { return json({ error: 'Invalid JSON body' }, 400) }
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email || !email.includes('@')) return json({ ok: true, message: GENERIC_RESET_MESSAGE })
    const ip = clientIp(request)
    const [emailAllowed, ipAllowed] = await Promise.all([
      bump(env.AUTH_KV, `secure_otp_send:reset:${email}`, MAX_SENDS, SEND_WINDOW_TTL),
      bump(env.AUTH_KV, `secure_otp_send_ip:reset:${ip}`, MAX_SENDS_PER_IP, SEND_WINDOW_TTL),
    ])
    if (!emailAllowed || !ipAllowed) return json({ ok: true, message: GENERIC_RESET_MESSAGE })
    const user = await getUserByEmail(env.AUTH_DB, email)
    if (!user) return json({ ok: true, message: GENERIC_RESET_MESSAGE })

    const code = generateOtp()
    const resetKey = `otp:${email}`
    await env.AUTH_KV.put(resetKey, await digestCode(env, 'password-reset', email, code), { expirationTtl: OTP_TTL })
    try {
      await sendCode(env, email, 'Your Otya password reset code', 'Use this code to reset your Otya password:', code, user.id)
    } catch (error) {
      await env.AUTH_KV.delete(resetKey)
      console.error('[auth/otp] Password-reset email failed:', (error as Error)?.message)
    }
    return json({ ok: true, message: GENERIC_RESET_MESSAGE })
  }

  if (path === '/auth/reset-password') {
    let body: { email?: string; otp?: string; new_password?: string }
    try { body = await request.json() as typeof body } catch { return json({ error: 'Invalid JSON body' }, 400) }
    const email = String(body.email ?? '').trim().toLowerCase()
    const code = String(body.otp ?? '').trim().toUpperCase()
    const password = String(body.new_password ?? '')
    if (!email || !CODE_RE.test(code) || password.length < 8) return json({ error: 'Invalid or expired verification code.' }, 401)
    const ip = clientIp(request)
    const [ipAllowed, emailAllowed] = await Promise.all([
      bump(env.AUTH_KV, `secure_otp_attempt:reset:${email}:${ip}`, MAX_ATTEMPTS, ATTEMPT_TTL),
      bump(env.AUTH_KV, `secure_otp_attempt_global:reset:${email}`, MAX_ATTEMPTS_PER_EMAIL, ATTEMPT_TTL),
    ])
    if (!ipAllowed || !emailAllowed) {
      return json({ error: 'Too many reset attempts. Request a new code later.' }, 429)
    }
    const stored = await env.AUTH_KV.get(`otp:${email}`)
    if (!(await matchesStoredCode(env, stored, 'password-reset', email, code))) {
      return json({ error: 'Invalid or expired verification code.' }, 401)
    }
    const user = await getUserByEmail(env.AUTH_DB, email)
    if (!user) return json({ error: 'Invalid or expired verification code.' }, 401)

    await updatePasswordHash(env.AUTH_DB, user.id, await hashPassword(password))
    await Promise.all([
      env.AUTH_KV.delete(`otp:${email}`),
      env.AUTH_KV.delete(`secure_otp_attempt:reset:${email}:${ip}`),
      env.AUTH_KV.delete(`secure_otp_attempt_global:reset:${email}`),
      revokeRefreshTokens(env, user.id),
    ])
    return json({ ok: true, message: 'Password updated successfully. Please sign in again.' })
  }

  const user = await requireUser(request, env)
  if (!user) return json({ error: 'Sign in to Otya first.' }, 401)

  if (path === '/auth/send-verification') {
    if (!user.email) return json({ error: 'Add an email address to your OTYA Account before verifying email.', code: 'EMAIL_REQUIRED' }, 400)
    if (user.is_verified) return json({ ok: true, message: 'Email already verified.' })
    if (!env.RESEND_API_KEY) return json({ error: 'Verification email is temporarily unavailable.' }, 503)
    if (!(await bump(env.AUTH_KV, `secure_otp_send:verify:${user.id}`, MAX_SENDS, SEND_WINDOW_TTL))) {
      return json({ error: 'Too many verification codes requested. Try again later.' }, 429)
    }
    const code = generateOtp()
    const verificationKey = `verify_otp:${user.id}`
    await env.AUTH_KV.put(verificationKey, await digestCode(env, 'verify-email', user.id, code), { expirationTtl: OTP_TTL })
    let telegramDelivered = false
    try {
      telegramDelivered = await sendCode(env, user.email, 'Your Otya verification code', 'Use this code to verify your Otya email address:', code, user.id)
    } catch (error) {
      await env.AUTH_KV.delete(verificationKey)
      console.error('[auth/otp] Verification email failed:', (error as Error)?.message)
      return json({ error: 'Verification email is temporarily unavailable.' }, 503)
    }
    return json({ ok: true, message: telegramDelivered ? 'Verification code sent to your email and linked Telegram.' : 'Verification code sent to your email.', channels: telegramDelivered ? ['email', 'telegram'] : ['email'] })
  }

  let body: { otp?: string }
  try { body = await request.json() as { otp?: string } } catch { return json({ error: 'Invalid JSON body' }, 400) }
  const code = String(body.otp ?? '').trim().toUpperCase()
  if (!CODE_RE.test(code)) return json({ error: 'Invalid or expired verification code.' }, 401)
  if (!(await bump(env.AUTH_KV, `secure_otp_attempt:verify:${user.id}`, MAX_ATTEMPTS, ATTEMPT_TTL))) {
    return json({ error: 'Too many verification attempts. Request a new code later.' }, 429)
  }
  const stored = await env.AUTH_KV.get(`verify_otp:${user.id}`)
  if (!(await matchesStoredCode(env, stored, 'verify-email', user.id, code))) {
    return json({ error: 'Invalid or expired verification code.' }, 401)
  }
  await env.AUTH_DB.prepare(
    "UPDATE users SET is_verified = 1, updated_at = datetime('now') WHERE id = ?",
  ).bind(user.id).run()
  await Promise.all([
    env.AUTH_KV.delete(`verify_otp:${user.id}`),
    env.AUTH_KV.delete(`secure_otp_attempt:verify:${user.id}`),
  ])
  return json({ ok: true, message: 'Email verified successfully.' })
}