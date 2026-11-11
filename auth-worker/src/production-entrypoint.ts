import authWorker from './entrypoint'
import { assertSchemaReady } from './db'
import { handleAdminMfa, type AdminMfaEnv } from './admin-mfa'
import { handleTelegramLogin, type TelegramLoginEnv } from './telegram-login'
import { handleGoogleLink } from './google-link'
import { deliverNewDeviceAlert, deliverRegistrationEmails } from './production-email'
import { handleSecureOtpRoute, type SecureOtpEnv } from './secure-otp'
import { handleSecureAccountRoute, type SecureAccountEnv } from './secure-account'
import { withAuthSecurityEvent } from './security-events'
import { sendResendEmail } from './resend'

interface GoogleTokenPayload {
  sub?: string
  aud?: string
  iss?: string
  exp?: string | number
  iat?: string | number
  email?: string
  email_verified?: string | boolean
  name?: string
  picture?: string
}

type ProductionEnv = Record<string, unknown> & AdminMfaEnv & TelegramLoginEnv & SecureOtpEnv & SecureAccountEnv & {
  GOOGLE_CLIENT_ID?: string
  GOOGLE_WEB_CLIENT_ID?: string
  RESEND_API_KEY?: string
  OTYA_NO_REPLY_EMAIL?: string
  OTYA_SUPPORT_EMAIL?: string
  OTYAPOINT_INVITE_SERVICE_TOKEN?: string | { get(): Promise<string> }
  OTYA_NEXT_MAIL_SERVICE_TOKEN?: string
  PREVERIFIED_GOOGLE_PAYLOAD?: GoogleTokenPayload
}

function noReplyEmail(env: ProductionEnv): string {
  const value = env.OTYA_NO_REPLY_EMAIL?.trim() || 'noreply@otya.site'
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value) ? value : 'noreply@otya.site'
}

function supportEmail(env: ProductionEnv): string {
  const value = env.OTYA_SUPPORT_EMAIL?.trim() || 'support@otya.site'
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value) ? value : 'support@otya.site'
}

let identitySchemaReady: Promise<void> | null = null
const GOOGLE_VERIFY_TIMEOUT_MS = 8000

function configuredGoogleAudiences(env: ProductionEnv): Set<string> {
  return new Set(
    [env.GOOGLE_CLIENT_ID, env.GOOGLE_WEB_CLIENT_ID]
      .map(value => typeof value === 'string' ? value.trim() : '')
      .filter(Boolean),
  )
}

export function isAllowedGoogleAudience(audience: string | undefined, env: ProductionEnv): boolean {
  if (!audience) return false
  return configuredGoogleAudiences(env).has(audience)
}

function authError(message: string, status: number, code?: string): Response {
  return new Response(JSON.stringify({ error: message, ...(code ? { code } : {}) }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function googleError(message: string, status: number): Response {
  return authError(message, status)
}

async function resolveSecretStoreValue(value: string | { get(): Promise<string> } | undefined): Promise<string> {
  if (typeof value === 'string') return value
  if (!value || typeof value.get !== 'function') return ''
  try {
    const secret = await value.get()
    return typeof secret === 'string' ? secret : ''
  } catch {
    return ''
  }
}

async function matchesInternalServiceSecret(provided: string, expected: string): Promise<boolean> {
  if (provided.length < 32 || expected.length < 32 || provided.length > 512 || expected.length > 512) return false
  const encoder = new TextEncoder()
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const a = new Uint8Array(left)
  const b = new Uint8Array(right)
  let difference = 0
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index]
  return difference === 0
}

async function handleOtyaPointStaffInvitation(request: Request, env: ProductionEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/internal/notifications/omnipoint/staff-invitation') return null
  if (request.method !== 'POST') return authError('Method not allowed', 405)
  // The service binding is the network boundary; the shared secret is a second
  // authorization boundary so another bound Worker cannot impersonate OtyaPoint.
  const expectedServiceSecret = await resolveSecretStoreValue(env.OTYAPOINT_INVITE_SERVICE_TOKEN)
  if (request.headers.get('x-otya-service') !== 'otyapoint'
    || !(await matchesInternalServiceSecret(
      request.headers.get('x-otya-service-token') || '',
      expectedServiceSecret,
    ))) return authError('Service not allowed', 403)
  if (Number(request.headers.get('content-length') || '0') > 4096) return authError('Payload too large', 413)

  let body: Record<string, unknown>
  try {
    const value = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) return authError('Invalid invitation payload', 400)
    body = value as Record<string, unknown>
  } catch {
    return authError('Invalid JSON body', 400)
  }

  const invitationId = typeof body.invitationId === 'string' ? body.invitationId.trim().toLowerCase() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const displayName = typeof body.displayName === 'string'
    ? body.displayName.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120)
    : ''
  const role = typeof body.role === 'string' ? body.role.trim() : ''
  const token = typeof body.token === 'string' ? body.token.trim().toLowerCase() : ''
  const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt.trim() : ''
  const expiration = Date.parse(expiresAt)

  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254) {
    return authError('Invalid invitation email', 400)
  }
  if (!/^[a-f0-9]{64}$/.test(token)) return authError('Invalid invitation token', 400)
  if (!['ATTENDANT', 'MANAGER', 'MANAGING_DIRECTOR', 'CHAIRMAN'].includes(role)) {
    return authError('Invalid invitation role', 400)
  }
  if (!Number.isFinite(expiration) || expiration <= Date.now() || expiration > Date.now() + 49 * 60 * 60 * 1000) {
    return authError('Invalid invitation expiry', 400)
  }
  if (!env.RESEND_API_KEY) return authError('Email service is unavailable', 503)

  const safeName = displayName || email.split('@')[0] || 'there'
  const tokenDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  const digestHex = Array.from(tokenDigest).map(byte => byte.toString(16).padStart(2, '0')).join('')
  try {
    await sendResendEmail(env.RESEND_API_KEY, {
      from: 'Otya <${noReplyEmail(env)}>',
      to: [email],
      replyTo: '${supportEmail(env)}',
      subject: 'You have been invited to OtyaPoint',
      idempotencyKey: `otyapoint/staff-invitation/${invitationId}/${digestHex}`,
      text: [
        `Hi ${safeName},`,
        '',
        'You have been invited to join the OtyaPoint shop operations workspace.',
        `Your invitation role: ${role}.`,
        '',
        'Sign in to your Otya Account, then enter this one-time invitation code in OtyaPoint:',
        '',
        token,
        '',
        `This invitation expires at ${new Date(expiration).toISOString()}.`,
        'After you accept, the shop owner must activate your membership before you can access shop operations.',
        '',
        'If you were not expecting this invitation, you can ignore this email.',
        '— The Otya Team',
      ].join('\n'),
    })
    return new Response(JSON.stringify({ accepted: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (error) {
    console.error(JSON.stringify({
      event: 'otya_staff_invitation_email_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }))
    return authError('Invitation email could not be delivered', 502)
  }
}

async function handleOtyaNextOpsEmail(request: Request, env: ProductionEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/internal/notifications/otya-next/ops-report') return null
  if (request.method !== 'POST') return authError('Method not allowed', 405)
  if (request.headers.get('x-otya-service') !== 'otya-next'
    || !(await matchesInternalServiceSecret(
      request.headers.get('x-otya-service-token') || '',
      env.OTYA_NEXT_MAIL_SERVICE_TOKEN || '',
    ))) return authError('Service not allowed', 403)

  const rawBody = await request.text()
  if (rawBody.length > 32 * 1024) return authError('Payload too large', 413)
  let body: Record<string, unknown>
  try {
    const value = JSON.parse(rawBody)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return authError('Invalid report payload', 400)
    body = value as Record<string, unknown>
  } catch {
    return authError('Invalid JSON body', 400)
  }

  const subject = typeof body.subject === 'string' ? body.subject.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 180) : ''
  const content = typeof body.text === 'string' ? body.text.trim() : ''
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
  if (!subject || !content || content.length > 28 * 1024) return authError('Invalid report content', 400)
  if (!/^[a-zA-Z0-9._:/-]{1,256}$/.test(idempotencyKey)) return authError('Invalid idempotency key', 400)
  if (!env.RESEND_API_KEY) return authError('Email service is unavailable', 503)

  const adminEmailValue = typeof env.ADMIN_EMAILS === 'string' ? env.ADMIN_EMAILS : ''
  const recipients = adminEmailValue.split(',').map(value => value.trim().toLowerCase())
    .filter(value => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && value.length <= 254)
  if (recipients.length === 0) return authError('Administrator email recipients are not configured', 503)

  try {
    const emailId = await sendResendEmail(env.RESEND_API_KEY, {
      from: 'Otya <${noReplyEmail(env)}>',
      to: recipients,
      replyTo: '${supportEmail(env)}',
      subject,
      text: content,
      idempotencyKey,
    })
    return new Response(JSON.stringify({ accepted: true, emailId }), {
      status: 202,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (error) {
    console.error(JSON.stringify({
      event: 'otya_next_ops_email_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }))
    return authError('Operations report email could not be delivered', 502)
  }
}

async function ensureIdentitySchema(env: ProductionEnv): Promise<Response | null> {
  try {
    if (!identitySchemaReady) {
      identitySchemaReady = assertSchemaReady(env.AUTH_DB).catch(error => {
        identitySchemaReady = null
        throw error
      })
    }
    await identitySchemaReady
    return null
  } catch (error) {
    console.error('[auth] Identity schema unavailable:', (error as Error)?.message)
    return authError('Otya Account is temporarily unavailable. Please try again shortly.', 503, 'AUTH_SCHEMA_UNAVAILABLE')
  }
}

function createsIdentitySession(request: Request, url: URL): boolean {
  return request.method === 'POST' && ['/auth/register', '/auth/login', '/auth/google'].includes(url.pathname)
}

async function verifiedGooglePayload(request: Request, env: ProductionEnv): Promise<GoogleTokenPayload | Response> {
  const audiences = configuredGoogleAudiences(env)
  if (audiences.size === 0) return googleError('Google auth not configured', 503)

  let body: Record<string, unknown>
  try { body = await request.clone().json() as Record<string, unknown> }
  catch { return googleError('Invalid JSON body', 400) }

  const idToken = body.id_token
  if (typeof idToken !== 'string' || !idToken) return googleError('id_token is required', 400)

  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(GOOGLE_VERIFY_TIMEOUT_MS),
      },
    )
    if (!response.ok) return googleError('Invalid Google ID token', 401)

    const payload = await response.json() as GoogleTokenPayload
    const verifiedEmail = payload.email_verified === true || payload.email_verified === 'true'
    const issuerOk = payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com'
    const expiry = Number(payload.exp ?? 0)
    const now = Math.floor(Date.now() / 1000)

    if (!payload.sub || !isAllowedGoogleAudience(payload.aud, env) || !issuerOk || !Number.isFinite(expiry) || expiry <= now || !verifiedEmail || !payload.email) {
      return googleError('Google account verification failed', 401)
    }
    return payload
  } catch {
    return googleError('Google verification service unavailable', 503)
  }
}

async function normalizeAccountResponse(response: Response, env: ProductionEnv): Promise<Response> {
  if (!response.ok) return response
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return response

  let data: Record<string, unknown>
  try { data = await response.clone().json() as Record<string, unknown> }
  catch { return response }

  const user = data.user
  if (!user || typeof user !== 'object' || Array.isArray(user)) return response
  const account = user as Record<string, unknown>
  const id = typeof account.id === 'string' ? account.id : ''
  if (!id) return response

  const hasPublicId = typeof account.otya_id === 'string' && account.otya_id.length > 0
  const hasUsername = typeof account.username === 'string' && account.username.length > 0
  if (hasPublicId && hasUsername) return response

  try {
    let normalizedData: Record<string, unknown> = data

    // Keep the immutable public OTYA ID normalization contract unchanged.
    // Username is additive and is resolved independently so an older schema can
    // never turn a successful sign-in into an outage during rollout.
    if (!hasPublicId) {
      const row = await env.AUTH_DB.prepare(
        'SELECT otya_id FROM users WHERE id = ? LIMIT 1',
      ).bind(id).first<{ otya_id?: string | null }>()
      if (row?.otya_id) {
        normalizedData = { ...data, user: { ...account, otya_id: row.otya_id } }
      }
    }

    if (!hasUsername) {
      try {
        const usernameRow = await env.AUTH_DB.prepare(
          'SELECT username FROM users WHERE id = ? LIMIT 1',
        ).bind(id).first<{ username?: string | null }>()
        if (usernameRow?.username) {
          const normalizedUser = normalizedData.user as Record<string, unknown>
          normalizedData = { ...normalizedData, user: { ...normalizedUser, username: usernameRow.username } }
        }
      } catch (error) {
        console.error('[auth] Could not attach OTYA username:', (error as Error)?.message)
      }
    }

    if (normalizedData === data) return response
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'no-store')
    return new Response(JSON.stringify(normalizedData), {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (error) {
    console.error('[auth] Could not attach public OTYA identity:', (error as Error)?.message)
    return response
  }
}

async function audited(request: Request, response: Response, env: ProductionEnv): Promise<Response> {
  return withAuthSecurityEvent(request, response, env)
}

export default {
  async fetch(request: Request, env: ProductionEnv): Promise<Response> {
    const url = new URL(request.url)

    const invitationResponse = await handleOtyaPointStaffInvitation(request, env)
    if (invitationResponse) return invitationResponse
    const opsEmailResponse = await handleOtyaNextOpsEmail(request, env)
    if (opsEmailResponse) return opsEmailResponse

    if (url.pathname.startsWith('/auth/admin/')) {
      const response = await handleAdminMfa(request, env)
      if (response) return audited(request, response, env)
    }

    if (url.pathname.startsWith('/auth/telegram/')) {
      const response = await handleTelegramLogin(request, env)
      if (response) return audited(request, response, env)
    }

    const googleLinkResponse = await handleGoogleLink(request, env)
    if (googleLinkResponse) return audited(request, googleLinkResponse, env)

    const secureAccountResponse = await handleSecureAccountRoute(request, env)
    if (secureAccountResponse) return audited(request, secureAccountResponse, env)

    const secureOtpResponse = await handleSecureOtpRoute(request, env)
    if (secureOtpResponse) return audited(request, secureOtpResponse, env)

    if (createsIdentitySession(request, url)) {
      const schemaError = await ensureIdentitySchema(env)
      if (schemaError) return audited(request, schemaError, env)
    }

    if (request.method === 'POST' && url.pathname === '/auth/google') {
      const googlePayload = await verifiedGooglePayload(request, env)
      if (googlePayload instanceof Response) return audited(request, googlePayload, env)
      const requestEnv = {
        ...env,
        GOOGLE_CLIENT_ID: googlePayload.aud,
        PREVERIFIED_GOOGLE_PAYLOAD: googlePayload,
        EMAIL: undefined,
      }
      const response = await authWorker.fetch(request, requestEnv as Parameters<typeof authWorker.fetch>[1])
      if (response.ok) {
        await deliverNewDeviceAlert(request, response, env).catch(error => {
          console.error('[auth/email] Google new-device alert failed:', (error as Error)?.message)
        })
      }
      const normalized = await normalizeAccountResponse(response, env)
      return audited(request, normalized, env)
    }

    const compatibilityEnv = { ...env, EMAIL: undefined }
    const response = await authWorker.fetch(request, compatibilityEnv as Parameters<typeof authWorker.fetch>[1])

    if (request.method === 'POST' && url.pathname === '/auth/register' && response.ok) {
      // Production registration owns the verification code. The compatibility
      // worker may create temporary legacy state, but no compatibility email is
      // allowed and the Resend pipeline replaces the active code exactly once.
      await deliverRegistrationEmails(response, env).catch(error => {
        console.error('[auth/email] Registration verification delivery failed:', (error as Error)?.message)
      })
    }

    if (request.method === 'POST' && url.pathname === '/auth/login' && response.ok) {
      await deliverNewDeviceAlert(request, response, env).catch(error => {
        console.error('[auth/email] Password new-device alert failed:', (error as Error)?.message)
      })
    }

    const normalized = await normalizeAccountResponse(response, env)
    return audited(request, normalized, env)
  },
}