import { generateOtp, verifyJwt } from './crypto'
import { sendResendEmail } from './resend'
import { assertSchemaReady, getUserById, type D1Database } from './db'
import { sendTelegramOtpToUser, type SecureOtpEnv } from './secure-otp'

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

export interface AdminMfaEnv {
  AUTH_DB: D1Database
  AUTH_KV: KVNamespaceLike
  AUTH_JWT_SECRET: string
  RESEND_API_KEY?: string
  ADMIN_EMAILS?: string
  INTERNAL_SECRET?: string
  CORE?: { fetch(request: Request): Promise<Response> }
}

const OTP_TTL = 10 * 60
const OTP_WINDOW_TTL = 15 * 60
const OTP_MAX_SENDS = 5
const OTP_MAX_ATTEMPTS = 8
const COMPLETE_TTL = 5 * 60
// Next is a private owner device, not a browser admin session. Once the owner
// completes the strong enrollment ceremony, keep the trusted device usable and
// renew it at most weekly. A new enrollment automatically replaces the previous
// trusted phone. Logout/revocation still removes access immediately.
const OWNER_GRANT_TTL = 30 * 24 * 60 * 60
const OWNER_GRANT_RENEW_AFTER = 7 * 24 * 60 * 60
const OWNER_GRANT_HEADER = 'X-OTYA-Owner-Grant'
const OWNER_DEVICE_HEADER = 'X-OTYA-Device-ID'

type OwnerGrantRecord = {
  digest: string
  device_hash: string
  issued_at: number
  renewed_at: number
}

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

function allowlist(env: AdminMfaEnv): Set<string> {
  return new Set((env.ADMIN_EMAILS ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean))
}

async function currentUser(request: Request, env: AdminMfaEnv) {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = await verifyJwt(auth.slice(7), env.AUTH_JWT_SECRET)
  if (!payload?.sub) return null
  await assertSchemaReady(env.AUTH_DB)
  return getUserById(env.AUTH_DB, payload.sub)
}

async function bump(env: AdminMfaEnv, key: string, max: number, ttl: number): Promise<boolean> {
  const raw = await env.AUTH_KV.get(key)
  const count = raw ? Number.parseInt(raw, 10) : 0
  if (count >= max) return false
  await env.AUTH_KV.put(key, String(count + 1), { expirationTtl: ttl })
  return true
}

function randomToken(bytes = 32): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes))
  let binary = ''
  for (const byte of data) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function digest(value: string): Promise<string> {
  const raw = new TextEncoder().encode(value)
  const hashed = await crypto.subtle.digest('SHA-256', raw)
  return toHex(new Uint8Array(hashed))
}

async function otpDigest(userId: string, otp: string): Promise<string> {
  return digest(`otya-admin-mfa:email:${userId}:${otp.trim().toUpperCase()}`)
}

async function telegramOtpDigest(userId: string, otp: string): Promise<string> {
  return digest(`otya-admin-mfa:telegram:${userId}:${otp.trim().toUpperCase()}`)
}

function deviceIdFrom(request: Request): string {
  const raw = request.headers.get(OWNER_DEVICE_HEADER)?.trim() ?? ''
  return /^[A-Za-z0-9._:-]{20,180}$/.test(raw) ? raw : ''
}

async function deviceDigest(deviceId: string): Promise<string> {
  return digest(`otya-owner-device:${deviceId}`)
}

async function ownerGrantDigest(userId: string, deviceId: string, token: string): Promise<string> {
  return digest(`otya-owner-grant:${userId}:${deviceId}:${token.trim()}`)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function requireAllowedAdmin(request: Request, env: AdminMfaEnv) {
  const user = await currentUser(request, env)
  if (!user?.email || !allowlist(env).has(user.email.toLowerCase())) return null
  return user
}

async function issueMobileOwnerGrant(env: AdminMfaEnv, userId: string, deviceId: string): Promise<string> {
  const grant = randomToken()
  const now = Math.floor(Date.now() / 1000)
  const record: OwnerGrantRecord = {
    digest: await ownerGrantDigest(userId, deviceId, grant),
    device_hash: await deviceDigest(deviceId),
    issued_at: now,
    renewed_at: now,
  }
  // One trusted owner phone at a time. Enrolling another phone replaces this
  // record, which silently revokes the previous device without a browser step.
  await env.AUTH_KV.put(
    `admin_owner_grant:${userId}`,
    JSON.stringify(record),
    { expirationTtl: OWNER_GRANT_TTL },
  )
  return grant
}

async function readOwnerGrant(env: AdminMfaEnv, userId: string): Promise<OwnerGrantRecord | null> {
  const raw = await env.AUTH_KV.get(`admin_owner_grant:${userId}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<OwnerGrantRecord>
    if (!parsed.digest || !parsed.device_hash || !parsed.issued_at || !parsed.renewed_at) return null
    return parsed as OwnerGrantRecord
  } catch {
    // Old one-hour string grants intentionally do not migrate into a trusted
    // device. The owner completes the stronger enrollment once on Next.
    return null
  }
}

async function verifyMobileOwnerGrant(request: Request, env: AdminMfaEnv, userId: string): Promise<boolean> {
  const grant = request.headers.get(OWNER_GRANT_HEADER)?.trim() ?? ''
  const deviceId = deviceIdFrom(request)
  if (!grant || !deviceId) return false

  const record = await readOwnerGrant(env, userId)
  if (!record) return false
  const suppliedDevice = await deviceDigest(deviceId)
  if (!timingSafeEqual(record.device_hash, suppliedDevice)) return false
  const supplied = await ownerGrantDigest(userId, deviceId, grant)
  if (!timingSafeEqual(record.digest, supplied)) return false

  // Sliding trusted-device session, but deliberately bounded to one KV renewal
  // write per week instead of a write on every AI request.
  const now = Math.floor(Date.now() / 1000)
  if (now - record.renewed_at >= OWNER_GRANT_RENEW_AFTER) {
    record.renewed_at = now
    await env.AUTH_KV.put(
      `admin_owner_grant:${userId}`,
      JSON.stringify(record),
      { expirationTtl: OWNER_GRANT_TTL },
    )
  }
  return true
}

export async function consumeAdminMfaCompletion(request: Request, env: AdminMfaEnv): Promise<{ ok: boolean; email?: string }> {
  const user = await requireAllowedAdmin(request, env)
  if (!user) return { ok: false }
  const marker = await env.AUTH_KV.get(`admin_mfa_complete:${user.id}`)
  if (!marker) return { ok: false }
  await env.AUTH_KV.delete(`admin_mfa_complete:${user.id}`)
  return { ok: true, email: user.email!.toLowerCase() }
}

export async function handleAdminMfa(request: Request, env: AdminMfaEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/auth/admin/')) return null
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const user = await requireAllowedAdmin(request, env)
  if (!user) return json({ error: 'Additional verification is required.' }, 403)

  if (url.pathname === '/auth/admin/start') {
    if (!(await bump(env, `admin_mfa_send:${user.id}`, OTP_MAX_SENDS, OTP_WINDOW_TTL))) {
      return json({ error: 'Too many verification requests. Try again later.' }, 429)
    }

    if (!user.email || Number(user.is_verified) !== 1 || !env.RESEND_API_KEY) {
      await Promise.all([
        env.AUTH_KV.delete(`admin_mfa_otp:${user.id}`),
        env.AUTH_KV.delete(`admin_mfa_telegram_otp:${user.id}`),
        env.AUTH_KV.delete(`admin_mfa_email_verified:${user.id}`),
      ])
      return json({ error: 'A verified Otya email and email delivery are required for owner verification.' }, 503)
    }
    if (!env.CORE?.fetch || !env.INTERNAL_SECRET) {
      return json({ error: 'The private Otya Telegram OTP delivery service is not configured.' }, 503)
    }

    const telegramChat = await env.AUTH_DB.prepare(
      "SELECT 1 AS linked FROM linked_identities WHERE user_id = ? AND provider = 'telegram_otp_bot' LIMIT 1",
    ).bind(user.id).first<{ linked?: number }>()
    if (!telegramChat) {
      return json({
        error: 'Connect your private OtyaPlayerBot chat in Account → Sign-in methods before using owner verification.',
        code: 'TELEGRAM_OTP_NOT_LINKED',
      }, 409)
    }

    const emailOtp = generateOtp()
    let telegramOtp = generateOtp()
    while (telegramOtp === emailOtp) telegramOtp = generateOtp()

    await Promise.all([
      env.AUTH_KV.put(`admin_mfa_otp:${user.id}`, await otpDigest(user.id, emailOtp), { expirationTtl: OTP_TTL }),
      env.AUTH_KV.put(`admin_mfa_telegram_otp:${user.id}`, await telegramOtpDigest(user.id, telegramOtp), { expirationTtl: OTP_TTL }),
    ])
    await Promise.all([
      env.AUTH_KV.delete(`admin_mfa_email_verified:${user.id}`),
      env.AUTH_KV.delete(`admin_mfa_complete:${user.id}`),
      env.AUTH_KV.delete(`admin_mfa_attempt:${user.id}`),
      env.AUTH_KV.delete(`admin_mfa_telegram_attempt:${user.id}`),
    ])

    try {
      await Promise.all([
        sendResendEmail(env.RESEND_API_KEY, {
          from: 'OTYA <noreply@petersmartlink.com>',
          to: [user.email],
          subject: 'Your Otya owner verification code',
          text: [
            'A request was made to unlock Otya owner controls.',
            '',
            `Email verification code: ${emailOtp}`,
            '',
            'A separate Telegram code has been sent to your linked private OtyaPlayerBot chat.',
            'Enter the email code first, then the different code delivered by the bot.',
            'Both codes expire in 10 minutes and can each be used only once.',
            '',
            'If you did not request this, do not share either code and review your Otya account security.',
          ].join('\n'),
        }),
        (async () => {
          const delivered = await sendTelegramOtpToUser(
            env as SecureOtpEnv,
            user.id,
            telegramOtp,
            'owner-admin-verification',
          )
          if (!delivered) throw new Error('No linked private Telegram OTP chat')
        })(),
      ])
    } catch (error) {
      await Promise.all([
        env.AUTH_KV.delete(`admin_mfa_otp:${user.id}`),
        env.AUTH_KV.delete(`admin_mfa_telegram_otp:${user.id}`),
        env.AUTH_KV.delete(`admin_mfa_email_verified:${user.id}`),
      ])
      console.error('[admin/mfa] Two-channel OTP delivery failed:', (error as Error)?.message)
      return json({ error: 'Otya could not deliver both owner verification codes. No code remains valid; check email and Telegram delivery, then try again.' }, 503)
    }
    return json({ ok: true, next: 'email-otp', delivery: 'email+telegram', expires_in: OTP_TTL })
  }

  if (url.pathname === '/auth/admin/verify-otp') {
    if (!(await bump(env, `admin_mfa_attempt:${user.id}`, OTP_MAX_ATTEMPTS, OTP_WINDOW_TTL))) {
      return json({ error: 'Too many verification attempts. Request new codes later.' }, 429)
    }
    const body = await request.json().catch(() => ({})) as { otp?: string }
    const supplied = String(body.otp ?? '').trim().toUpperCase()
    if (!/^[A-Z][0-9]{4}$/.test(supplied)) return json({ error: 'Invalid or expired email verification code.' }, 401)

    const storedDigest = await env.AUTH_KV.get(`admin_mfa_otp:${user.id}`)
    const suppliedDigest = await otpDigest(user.id, supplied)
    if (!storedDigest || !timingSafeEqual(suppliedDigest, storedDigest)) {
      return json({ error: 'Invalid or expired email verification code.' }, 401)
    }

    await Promise.all([
      env.AUTH_KV.delete(`admin_mfa_otp:${user.id}`),
      env.AUTH_KV.delete(`admin_mfa_attempt:${user.id}`),
      env.AUTH_KV.put(`admin_mfa_email_verified:${user.id}`, randomToken(), { expirationTtl: OTP_TTL }),
    ])
    return json({ ok: true, next: 'telegram-otp', expires_in: OTP_TTL })
  }

  if (url.pathname === '/auth/admin/verify-telegram-otp') {
    if (!(await env.AUTH_KV.get(`admin_mfa_email_verified:${user.id}`))) {
      return json({ error: 'Verify the code sent to your Otya email first.' }, 403)
    }
    if (!(await bump(env, `admin_mfa_telegram_attempt:${user.id}`, OTP_MAX_ATTEMPTS, OTP_WINDOW_TTL))) {
      return json({ error: 'Too many Telegram code attempts. Request new codes later.' }, 429)
    }
    const body = await request.json().catch(() => ({})) as { otp?: string }
    const supplied = String(body.otp ?? '').trim().toUpperCase()
    if (!/^[A-Z][0-9]{4}$/.test(supplied)) return json({ error: 'Invalid or expired Telegram verification code.' }, 401)

    const storedDigest = await env.AUTH_KV.get(`admin_mfa_telegram_otp:${user.id}`)
    const suppliedDigest = await telegramOtpDigest(user.id, supplied)
    if (!storedDigest || !timingSafeEqual(suppliedDigest, storedDigest)) {
      return json({ error: 'Invalid or expired Telegram verification code.' }, 401)
    }

    await Promise.all([
      env.AUTH_KV.delete(`admin_mfa_otp:${user.id}`),
      env.AUTH_KV.delete(`admin_mfa_telegram_otp:${user.id}`),
      env.AUTH_KV.delete(`admin_mfa_email_verified:${user.id}`),
      env.AUTH_KV.delete(`admin_mfa_attempt:${user.id}`),
      env.AUTH_KV.delete(`admin_mfa_telegram_attempt:${user.id}`),
      env.AUTH_KV.put(`admin_mfa_complete:${user.id}`, randomToken(), { expirationTtl: COMPLETE_TTL }),
    ])
    return json({ ok: true, next: 'complete' })
  }

  if (url.pathname === '/auth/admin/consume') {
    const marker = await env.AUTH_KV.get(`admin_mfa_complete:${user.id}`)
    if (!marker) return json({ error: 'Complete both email and Telegram OTP checks first.' }, 401)
    await env.AUTH_KV.delete(`admin_mfa_complete:${user.id}`)
    return json({ ok: true, email: user.email!.toLowerCase() })
  }

  if (url.pathname === '/auth/admin/mobile-grant') {
    const marker = await env.AUTH_KV.get(`admin_mfa_complete:${user.id}`)
    if (!marker) return json({ error: 'Complete Telegram verification first.' }, 401)
    const deviceId = deviceIdFrom(request)
    if (!deviceId) return json({ error: 'A valid Next device identity is required.' }, 400)
    await env.AUTH_KV.delete(`admin_mfa_complete:${user.id}`)
    const grant = await issueMobileOwnerGrant(env, user.id, deviceId)
    return json({
      ok: true,
      email: user.email!.toLowerCase(),
      owner_grant: grant,
      trusted_device: true,
      expires_in: OWNER_GRANT_TTL,
      renew_after: OWNER_GRANT_RENEW_AFTER,
    })
  }

  if (url.pathname === '/auth/admin/verify-grant') {
    const ok = await verifyMobileOwnerGrant(request, env, user.id)
    return ok
      ? json({
          ok: true,
          email: user.email!.toLowerCase(),
          trusted_device: true,
          expires_in: OWNER_GRANT_TTL,
          renew_after: OWNER_GRANT_RENEW_AFTER,
        })
      : json({ error: 'Owner device verification is required.' }, 401)
  }

  if (url.pathname === '/auth/admin/revoke-grant') {
    await env.AUTH_KV.delete(`admin_owner_grant:${user.id}`)
    return json({ ok: true })
  }

  return json({ error: 'Not found' }, 404)
}
