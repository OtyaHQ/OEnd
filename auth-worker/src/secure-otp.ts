import { generateOtp, hashPassword, verifyJwt } from './crypto'
import { getUserByEmail, getUserById, updatePasswordHash, type D1Database } from './db'
import { sendResendEmail } from './resend'
import { commitVerifiedEmailChange } from './email-change-commit.mjs'

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

export interface SecureOtpEnv {
  AUTH_DB: D1Database
  AUTH_KV: KVNamespaceLike
  AUTH_JWT_SECRET: string
  RESEND_API_KEY?: string
  INTERNAL_SECRET?: string
  CORE?: { fetch(request: Request): Promise<Response> }
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

async function sendCode(env: SecureOtpEnv, to: string, subject: string, intro: string, code: string): Promise<void> {
  await sendResendEmail(env.RESEND_API_KEY, {
    from: 'OTYA <noreply@petersmartlink.com>',
    to: [to],
    subject,
    text: [
      intro,
      '',
      code,
      '',
      'This code expires in 10 minutes.',
      'It contains 1 uppercase letter followed by 4 digits.',
      '',
      'If you did not request this, you can ignore this message.',
      '— The Otya Team',
    ].join('\n'),
  })
}


function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
}

function randomUrlSafe(bytes = 32): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes))
  let binary = ''
  for (const byte of data) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return toHex(new Uint8Array(digest))
}

async function telegramOtpChatId(env: SecureOtpEnv, userId: string): Promise<string | null> {
  const row = await env.AUTH_DB.prepare(
    "SELECT provider_subject FROM linked_identities WHERE user_id = ? AND provider = 'telegram_otp_bot' LIMIT 1",
  ).bind(userId).first<{ provider_subject?: string }>()
  const chatId = String(row?.provider_subject ?? '').trim()
  return /^[1-9][0-9]{3,15}$/.test(chatId) ? chatId : null
}

/** Sends a security code through Otya Core's existing Telegram bot service binding. */
async function sendTelegramCode(env: SecureOtpEnv, chatId: string, code: string, purpose: string): Promise<void> {
  if (!env.CORE?.fetch || !env.INTERNAL_SECRET) {
    throw new Error('Otya Telegram delivery service is unavailable')
  }
  const response = await env.CORE.fetch(new Request('https://otya-core/internal/telegram/otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTYA-Internal-Secret': env.INTERNAL_SECRET,
      'X-OTYA-Service': 'otya-auth',
    },
    body: JSON.stringify({ chat_id: chatId, code, purpose }),
    signal: AbortSignal.timeout(8000),
  }))
  if (!response.ok) throw new Error('Telegram security code delivery failed')
}

/** Returns false when the account has not explicitly linked a Telegram bot chat for OTP delivery. */
export async function sendTelegramOtpToUser(
  env: SecureOtpEnv,
  userId: string,
  code: string,
  purpose: string,
): Promise<boolean> {
  const chatId = await telegramOtpChatId(env, userId)
  if (!chatId) return false
  await sendTelegramCode(env, chatId, code, purpose)
  return true
}

async function notifyEmailChange(
  env: SecureOtpEnv,
  recipient: string | null,
  newEmail: string,
  stage: 'requested' | 'completed',
): Promise<void> {
  if (!recipient || !env.RESEND_API_KEY) return
  try {
    await sendResendEmail(env.RESEND_API_KEY, {
      from: 'OTYA <noreply@petersmartlink.com>',
      to: [recipient],
      subject: stage === 'requested' ? 'Otya primary email change requested' : 'Your Otya primary email was changed',
      text: stage === 'requested'
        ? `A request was made to change your Otya primary email to ${newEmail}. Your current email has not changed. If this was not you, sign in to Otya and secure your account.`
        : `Your Otya primary email has been changed to ${newEmail}. Your existing Otya ID and linked sign-in methods were preserved. If this was not you, recover your Google or Telegram account and contact Otya Support immediately.`,
    })
  } catch (error) {
    console.error('[auth/email-change] Security notification failed:', (error as Error)?.message)
  }
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
  if (![
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/send-verification',
    '/auth/verify-email',
    '/auth/email-change/request',
    '/auth/email-change/confirm',
    '/auth/telegram-otp/link/start',
    '/auth/telegram-otp/link/confirm',
    '/auth/telegram-otp/link/revoke',
  ].includes(path)) {
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
      await (await telegramOtpChatId(env, user.id)
        ? sendTelegramOtpToUser(env, user.id, code, 'password-reset').then(() => undefined)
        : sendCode(env, email, 'Your Otya password reset code', 'Use this code to reset your Otya password:', code))
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

  if (path === '/auth/telegram-otp/link/confirm') {
    const suppliedSecret = request.headers.get('X-OTYA-Internal-Secret')?.trim() ?? ''
    if (!env.INTERNAL_SECRET || !timingSafeEqual(suppliedSecret, env.INTERNAL_SECRET)
      || request.headers.get('X-OTYA-Service') !== 'otya-core') {
      return json({ error: 'Unauthorized' }, 401)
    }

    let body: { challenge?: string; chat_id?: string | number; username?: string }
    try { body = await request.json() as typeof body }
    catch { return json({ error: 'Invalid JSON body' }, 400) }

    const challenge = String(body.challenge ?? '').trim()
    const chatId = String(body.chat_id ?? '').trim()
    const username = String(body.username ?? '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 80) || null
    if (!/^[A-Za-z0-9_-]{32,80}$/.test(challenge) || !/^[1-9][0-9]{3,15}$/.test(chatId)) {
      return json({ error: 'Invalid Telegram connection challenge.' }, 400)
    }

    const challengeKey = `telegram_otp_link:${await sha256Hex(challenge)}`
    const userId = await env.AUTH_KV.get(challengeKey)
    if (!userId) return json({ error: 'This Telegram connection link has expired. Start again in Otya Account settings.' }, 401)

    const user = await getUserById(env.AUTH_DB, userId)
    if (!user?.email || Number(user.is_verified) !== 1) {
      await env.AUTH_KV.delete(challengeKey)
      return json({ error: 'The Otya account is no longer eligible for Telegram OTP delivery.' }, 409)
    }

    const chatOwner = await env.AUTH_DB.prepare(
      "SELECT user_id FROM linked_identities WHERE provider = 'telegram_otp_bot' AND provider_subject = ? LIMIT 1",
    ).bind(chatId).first<{ user_id?: string }>()
    if (chatOwner?.user_id && chatOwner.user_id !== userId) {
      await env.AUTH_KV.delete(challengeKey)
      return json({ error: 'This Telegram chat is already connected to another Otya account.' }, 409)
    }

    await env.AUTH_DB.prepare(`
      INSERT INTO linked_identities (user_id, provider, provider_subject, provider_username)
      VALUES (?, 'telegram_otp_bot', ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        provider_subject = excluded.provider_subject,
        provider_username = excluded.provider_username,
        last_used_at = datetime('now')
    `).bind(userId, chatId, username).run()
    await env.AUTH_KV.delete(challengeKey)
    return json({ ok: true, telegram_otp_enabled: true })
  }

  const user = await requireUser(request, env)
  if (!user) return json({ error: 'Sign in to Otya first.' }, 401)

  if (path === '/auth/telegram-otp/link/start') {
    if (!user.email || Number(user.is_verified) !== 1) {
      return json({ error: 'Verify your Otya primary email before connecting Telegram OTP.' }, 409)
    }
    const ip = clientIp(request)
    const [userAllowed, ipAllowed] = await Promise.all([
      bump(env.AUTH_KV, `telegram_otp_link_send:${user.id}`, MAX_SENDS, SEND_WINDOW_TTL),
      bump(env.AUTH_KV, `telegram_otp_link_ip:${ip}`, MAX_SENDS_PER_IP, SEND_WINDOW_TTL),
    ])
    if (!userAllowed || !ipAllowed) return json({ error: 'Too many Telegram connection requests. Try again later.' }, 429)

    const challenge = randomUrlSafe(32)
    await env.AUTH_KV.put(
      `telegram_otp_link:${await sha256Hex(challenge)}`,
      user.id,
      { expirationTtl: OTP_TTL },
    )
    return json({
      ok: true,
      bot_url: `https://t.me/OtyaPlayerBot?start=otya_otp_${challenge}`,
      expires_in: OTP_TTL,
      message: 'Open OtyaPlayerBot and press Start to connect this private chat for security codes. Telegram will not become a sign-in method.',
    })
  }

  if (path === '/auth/telegram-otp/link/revoke') {
    await env.AUTH_DB.prepare(
      "DELETE FROM linked_identities WHERE user_id = ? AND provider = 'telegram_otp_bot'",
    ).bind(user.id).run()
    return json({ ok: true, telegram_otp_enabled: false })
  }

  if (path === '/auth/email-change/request') {
    let body: { email?: string }
    try { body = await request.json() as { email?: string } }
    catch { return json({ error: 'Invalid JSON body' }, 400) }

    const newEmail = String(body.email ?? '').trim().toLowerCase()
    const currentEmail = user.email?.trim().toLowerCase() ?? ''
    if (!user.email || Number(user.is_verified) !== 1) {
      return json({ error: 'Verify your current primary email before changing it.', code: 'CURRENT_EMAIL_NOT_VERIFIED' }, 409)
    }
    if (!validEmail(newEmail)) return json({ error: 'Enter a valid new email address.' }, 400)
    if (newEmail === currentEmail) return json({ error: 'That is already your primary email address.' }, 400)
    if (!env.RESEND_API_KEY) return json({ error: 'Email verification is temporarily unavailable.' }, 503)

    const ip = clientIp(request)
    // Charge all address checks against the same limits to prevent account enumeration.
    const [userAllowed, targetAllowed, ipAllowed] = await Promise.all([
      bump(env.AUTH_KV, `secure_otp_send:email-change:${user.id}`, MAX_SENDS, SEND_WINDOW_TTL),
      bump(env.AUTH_KV, `secure_otp_send:email-change-target:${newEmail}`, MAX_SENDS, SEND_WINDOW_TTL),
      bump(env.AUTH_KV, `secure_otp_send_ip:email-change:${ip}`, MAX_SENDS_PER_IP, SEND_WINDOW_TTL),
    ])
    if (!userAllowed || !targetAllowed || !ipAllowed) {
      return json({ error: 'Too many email-change requests. Try again later.' }, 429)
    }

    const existing = await getUserByEmail(env.AUTH_DB, newEmail)
    if (existing && existing.id !== user.id) {
      return json({ error: 'That email is already connected to another Otya account.', code: 'EMAIL_IN_USE' }, 409)
    }

    const chatId = await telegramOtpChatId(env, user.id)
    if (!chatId) {
      return json({
        error: 'Connect your private Telegram chat in Otya Account settings before changing your primary email.',
        code: 'TELEGRAM_OTP_NOT_LINKED',
      }, 409)
    }

    const currentCode = generateOtp()
    const newCode = generateOtp()
    const pendingKey = `email_change_pending:${user.id}`
    const currentOtpKey = `email_change_current_otp:${user.id}`
    const newOtpKey = `email_change_new_otp:${user.id}`
    const subject = `${user.id}:${currentEmail}:${newEmail}`
    await Promise.all([
      env.AUTH_KV.put(pendingKey, JSON.stringify({ currentEmail, newEmail }), { expirationTtl: OTP_TTL }),
      env.AUTH_KV.put(currentOtpKey, await digestCode(env, 'email-change-current', subject, currentCode), { expirationTtl: OTP_TTL }),
      env.AUTH_KV.put(newOtpKey, await digestCode(env, 'email-change-new', subject, newCode), { expirationTtl: OTP_TTL }),
    ])

    try {
      await sendTelegramCode(env, chatId, currentCode, 'email-change')
      await sendCode(env, newEmail, 'Verify your new Otya email', 'Use this code to verify the new primary email address for your Otya account:', newCode)
    } catch (error) {
      await Promise.all([
        env.AUTH_KV.delete(pendingKey),
        env.AUTH_KV.delete(currentOtpKey),
        env.AUTH_KV.delete(newOtpKey),
      ])
      console.error('[auth/email-change] Verification email failed:', (error as Error)?.message)
      return json({ error: 'A verification email could not be sent. Your current email has not changed.' }, 503)
    }

    await notifyEmailChange(env, currentEmail, newEmail, 'requested')
    return json({ ok: true, message: 'One security code was sent to your linked Otya Telegram bot chat and a second code to your new email. Your current email remains active until both are confirmed.' })
  }

  if (path === '/auth/email-change/confirm') {
    let body: { current_otp?: string; new_otp?: string }
    try { body = await request.json() as { current_otp?: string; new_otp?: string } }
    catch { return json({ error: 'Invalid JSON body' }, 400) }

    const currentCode = String(body.current_otp ?? '').trim().toUpperCase()
    const newCode = String(body.new_otp ?? '').trim().toUpperCase()
    if (!CODE_RE.test(currentCode) || !CODE_RE.test(newCode)) {
      return json({ error: 'Enter both valid verification codes.' }, 401)
    }

    const ip = clientIp(request)
    const [ipAllowed, userAllowed] = await Promise.all([
      bump(env.AUTH_KV, `secure_otp_attempt:email-change:${user.id}:${ip}`, MAX_ATTEMPTS, ATTEMPT_TTL),
      bump(env.AUTH_KV, `secure_otp_attempt_global:email-change:${user.id}`, MAX_ATTEMPTS_PER_EMAIL, ATTEMPT_TTL),
    ])
    if (!ipAllowed || !userAllowed) {
      return json({ error: 'Too many verification attempts. Request a new code later.' }, 429)
    }

    const pendingKey = `email_change_pending:${user.id}`
    const currentOtpKey = `email_change_current_otp:${user.id}`
    const newOtpKey = `email_change_new_otp:${user.id}`
    const [pendingRaw, currentStored, newStored] = await Promise.all([
      env.AUTH_KV.get(pendingKey),
      env.AUTH_KV.get(currentOtpKey),
      env.AUTH_KV.get(newOtpKey),
    ])
    if (!pendingRaw || !currentStored || !newStored) {
      return json({ error: 'No complete pending email change. Request two new verification codes.' }, 400)
    }

    let pending: { currentEmail?: unknown; newEmail?: unknown }
    try { pending = JSON.parse(pendingRaw) as typeof pending }
    catch {
      await Promise.all([
        env.AUTH_KV.delete(pendingKey),
        env.AUTH_KV.delete(currentOtpKey),
        env.AUTH_KV.delete(newOtpKey),
      ])
      return json({ error: 'The email-change request expired. Please start again.' }, 400)
    }

    const currentEmail = typeof pending.currentEmail === 'string' ? pending.currentEmail : ''
    const newEmail = typeof pending.newEmail === 'string' ? pending.newEmail : ''
    if (!currentEmail || currentEmail !== user.email?.trim().toLowerCase() || !validEmail(newEmail)) {
      await Promise.all([
        env.AUTH_KV.delete(pendingKey),
        env.AUTH_KV.delete(currentOtpKey),
        env.AUTH_KV.delete(newOtpKey),
      ])
      return json({ error: 'Your account changed after this request. Please start the email change again.' }, 409)
    }

    const subject = `${user.id}:${currentEmail}:${newEmail}`
    const [currentMatches, newMatches] = await Promise.all([
      matchesStoredCode(env, currentStored, 'email-change-current', subject, currentCode),
      matchesStoredCode(env, newStored, 'email-change-new', subject, newCode),
    ])
    if (!currentMatches || !newMatches) {
      return json({ error: 'One or both verification codes are invalid or expired. Your email has not changed.' }, 401)
    }

    const latest = await getUserById(env.AUTH_DB, user.id)
    if (!latest || latest.email?.trim().toLowerCase() !== currentEmail || Number(latest.is_verified) !== 1) {
      await Promise.all([
        env.AUTH_KV.delete(pendingKey),
        env.AUTH_KV.delete(currentOtpKey),
        env.AUTH_KV.delete(newOtpKey),
      ])
      return json({ error: 'Your primary email changed or is no longer verified. Please sign in again.' }, 409)
    }

    const emailOwner = await getUserByEmail(env.AUTH_DB, newEmail)
    if (emailOwner && emailOwner.id !== user.id) {
      await Promise.all([
        env.AUTH_KV.delete(pendingKey),
        env.AUTH_KV.delete(currentOtpKey),
        env.AUTH_KV.delete(newOtpKey),
      ])
      return json({ error: 'That email is already connected to another Otya account.', code: 'EMAIL_IN_USE' }, 409)
    }

    let commit
    try {
      commit = await commitVerifiedEmailChange({
        revokeSessions: () => revokeRefreshTokens(env, user.id),
        updatePrimaryEmail: async () => {
          const update = await env.AUTH_DB.prepare(
            "UPDATE users SET email = ?, is_verified = 1, updated_at = datetime('now') WHERE id = ? AND email = ?",
          ).bind(newEmail, user.id, currentEmail).run()
          return { updated: Number(update.meta.changes) === 1 }
        },
      })
    } catch (error) {
      console.error('[auth/email-change] Initial session revocation failed:', (error as Error)?.message)
      return json({
        error: 'Otya could not safely close existing sessions. Your primary email has not changed; try again.',
        email_updated: false,
        session_revocation_complete: false,
      }, 503)
    }

    if (commit.updateError) {
      const message = String(commit.updateError).toLowerCase()
      if (message.includes('unique constraint') || message.includes('constraint failed') || message.includes('sqlite_constraint')) {
        return json({
          error: 'That email is already connected to another Otya account.',
          code: 'EMAIL_IN_USE',
          email_updated: false,
          session_revocation_complete: commit.sessionsRevoked,
          message: 'Your email was not changed. You may need to sign in again for security.',
        }, 409)
      }
      console.error('[auth/email-change] Primary email update failed:', message)
      return json({
        error: 'Otya could not update your primary email. Your current address remains active.',
        email_updated: false,
        session_revocation_complete: commit.sessionsRevoked,
        message: 'You may need to sign in again for security.',
      }, 503)
    }

    if (!commit.updated) {
      return json({
        error: 'Your account changed during this request. Your primary email was not changed.',
        email_updated: false,
        session_revocation_complete: commit.sessionsRevoked,
        message: 'You may need to sign in again for security.',
      }, 409)
    }

    await Promise.all([
      env.AUTH_KV.delete(pendingKey),
      env.AUTH_KV.delete(currentOtpKey),
      env.AUTH_KV.delete(newOtpKey),
      env.AUTH_KV.delete(`secure_otp_attempt:email-change:${user.id}:${ip}`),
      env.AUTH_KV.delete(`secure_otp_attempt_global:email-change:${user.id}`),
    ])

    await notifyEmailChange(env, currentEmail, newEmail, 'completed')

    return json({
      ok: true,
      sign_in_again: true,
      session_revocation_complete: commit.sessionsRevoked,
      message: commit.sessionsRevoked
        ? 'Your primary email has been updated, both verification steps succeeded, and all refresh sessions were revoked. Sign in again to continue.'
        : 'Your primary email was updated, but Otya could not confirm that every refresh session was revoked. Sign in again and contact Otya Support.',
    })
  }

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
    try {
      await sendCode(env, user.email, 'Your Otya verification code', 'Use this code to verify your Otya email address:', code)
    } catch (error) {
      await env.AUTH_KV.delete(verificationKey)
      console.error('[auth/otp] Verification email failed:', (error as Error)?.message)
      return json({ error: 'Verification email is temporarily unavailable.' }, 503)
    }
    return json({ ok: true, message: 'Verification code sent.' })
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