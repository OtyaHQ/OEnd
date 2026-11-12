import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

import { verifyTurnstileToken } from '@/lib/turnstile'

export const dynamic = 'force-dynamic'

const ACCESS_COOKIE = '__Secure-otya_access'
const REFRESH_COOKIE = '__Secure-otya_refresh'
function cookieDomainForRequest(request: NextRequest): string | undefined {
  const hostname = new URL(request.url).hostname.toLowerCase()
  if (hostname === 'otya.site' || hostname.endsWith('.otya.site')) return '.otya.site'
  if (hostname === 'petersmartlink.com' || hostname.endsWith('.petersmartlink.com')) return '.petersmartlink.com'
  return undefined
}
const ACCESS_MAX_AGE = 15 * 60
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60
const TURNSTILE_PROTECTED_AUTH = new Set([
  'login',
  'register',
  'google',
  'forgot-password',
  'reset-password',
])

type AuthBinding = { fetch(request: Request): Promise<Response> }
type JsonRecord = Record<string, unknown>

function jsonRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function safePath(parts: string[]): string {
  return parts.filter(Boolean).map(part => encodeURIComponent(part)).join('/')
}

function cookieOptions(maxAge: number, request: NextRequest) {
  const domain = cookieDomainForRequest(request)
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    ...(domain ? { domain } : {}),
    path: '/',
    maxAge,
  }
}

function clearSessionCookies(response: NextResponse, request: NextRequest) {
  response.cookies.set(ACCESS_COOKIE, '', { ...cookieOptions(0, request), expires: new Date(0) })
  response.cookies.set(REFRESH_COOKIE, '', { ...cookieOptions(0, request), expires: new Date(0) })
}

function setSessionCookies(response: NextResponse, accessToken: string, refreshToken: string | undefined, request: NextRequest) {
  response.cookies.set(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_MAX_AGE, request))
  if (refreshToken) response.cookies.set(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE, request))
}

async function getAuthBinding() {
  const { env } = await getCloudflareContext({ async: true })
  return (env as Record<string, unknown>).AUTH as AuthBinding | undefined
}

async function authFetch(auth: AuthBinding, path: string, request: NextRequest, options: { accessToken?: string; body?: ArrayBuffer | string; method?: string } = {}) {
  const sourceUrl = new URL(request.url)
  const target = new URL(`https://auth/auth/${path}`)
  target.search = sourceUrl.search
  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('Content-Type', contentType)
  headers.set('Accept', 'application/json')
  headers.set('X-Forwarded-Host', sourceUrl.host)
  headers.set('X-Forwarded-Proto', 'https')
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`)
  const method = options.method ?? request.method
  const init: RequestInit = { method, headers, redirect: 'manual' }
  if (method !== 'GET' && method !== 'HEAD' && options.body !== undefined) init.body = options.body
  return auth.fetch(new Request(target.toString(), init))
}

async function decode(upstream: Response): Promise<JsonRecord> {
  try { return jsonRecord(await upstream.json()) } catch { return {} }
}

function sanitizedAuthPayload(data: JsonRecord) {
  const result: JsonRecord = { ...data }
  delete result.access_token
  delete result.refresh_token
  return result
}

function securityFailure(result: Exclude<Awaited<ReturnType<typeof verifyTurnstileToken>>, { ok: true }>) {
  return NextResponse.json(
    { error: result.error, code: result.code },
    {
      status: result.status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}

async function protectedBrowserBody(request: NextRequest, suffix: string): Promise<string | ArrayBuffer | NextResponse | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  if (!TURNSTILE_PROTECTED_AUTH.has(suffix)) return request.arrayBuffer()

  let body: JsonRecord
  try {
    body = jsonRecord(await request.json())
  } catch {
    return NextResponse.json(
      { error: 'Invalid authentication request.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const verification = await verifyTurnstileToken(body.turnstile_token, request)
  if (!verification.ok) return securityFailure(verification)

  delete body.turnstile_token
  return JSON.stringify(body)
}

async function refreshBrowserSession(auth: AuthBinding, request: NextRequest): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  if (!refreshToken) return null
  const upstream = await auth.fetch(new Request('https://auth/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  }))
  if (!upstream.ok) return null
  const data = await decode(upstream)
  const accessToken = typeof data.access_token === 'string' ? data.access_token : ''
  const rotatedRefresh = typeof data.refresh_token === 'string' ? data.refresh_token : undefined
  return accessToken ? { accessToken, refreshToken: rotatedRefresh } : null
}

async function proxyBrowserAccount(request: NextRequest, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const auth = await getAuthBinding()
  if (!auth) return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  const { path } = await context.params
  const parts = Array.isArray(path) ? path : []
  const suffix = safePath(parts)
  if (!suffix) return NextResponse.json({ error: 'Account route is required' }, { status: 400 })

  const first = parts[0] ?? ''
  // Only the exact login/register/google endpoints create a browser session.
  // Nested routes such as google/link are protected account actions and must
  // receive the current OTYA access token rather than being treated as sign-in.
  const sessionCreatingEntry = ['login', 'register', 'google'].includes(suffix)
  const publicAction = ['forgot-password', 'reset-password'].includes(first)
  const isLogout = first === 'logout'
  const isSessionProbe = first === 'session'

  if (isSessionProbe) {
    let accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? ''
    let refreshed: { accessToken: string; refreshToken?: string } | null = null
    if (!accessToken) {
      refreshed = await refreshBrowserSession(auth, request)
      accessToken = refreshed?.accessToken ?? ''
    }
    if (!accessToken) {
      const response = NextResponse.json({ ok: true, authenticated: false })
      clearSessionCookies(response, request)
      return response
    }
    let upstream = await auth.fetch(new Request('https://auth/auth/account', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }))
    if (upstream.status === 401 || upstream.status === 403) {
      refreshed = await refreshBrowserSession(auth, request)
      if (!refreshed) {
        const response = NextResponse.json({ ok: true, authenticated: false })
        clearSessionCookies(response, request)
        return response
      }
      accessToken = refreshed.accessToken
      upstream = await auth.fetch(new Request('https://auth/auth/account', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }))
    }
    if (!upstream.ok) {
      const data = await decode(upstream)
      return NextResponse.json({ ok: false, error: data.error || 'Could not verify OTYA account session' }, { status: upstream.status })
    }
    const data = await decode(upstream)
    const response = NextResponse.json({ ok: true, authenticated: true, ...data })
    setSessionCookies(response, accessToken, refreshed?.refreshToken, request)
    return response
  }

  const requestBody = await protectedBrowserBody(request, suffix)
  if (requestBody instanceof NextResponse) return requestBody

  if (publicAction) {
    const upstream = await authFetch(auth, suffix, request, { body: requestBody })
    const data = await decode(upstream)
    const response = NextResponse.json(data, { status: upstream.status })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  if (sessionCreatingEntry) {
    const upstream = await authFetch(auth, suffix, request, { body: requestBody })
    const data = await decode(upstream)
    if (!upstream.ok) return NextResponse.json(data, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } })
    const accessToken = typeof data.access_token === 'string' ? data.access_token : ''
    const refreshToken = typeof data.refresh_token === 'string' ? data.refresh_token : ''
    if (!accessToken || !refreshToken) return NextResponse.json({ error: 'Authentication service did not create a complete session' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
    const response = NextResponse.json(sanitizedAuthPayload(data), { status: upstream.status })
    setSessionCookies(response, accessToken, refreshToken, request)
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  if (isLogout) {
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value ?? ''
    if (refreshToken) {
      try {
        await auth.fetch(new Request('https://auth/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) }))
      } catch {}
    }
    const response = NextResponse.json({ ok: true })
    clearSessionCookies(response, request)
    return response
  }

  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? ''
  let refreshed: { accessToken: string; refreshToken?: string } | null = null
  if (!accessToken) {
    refreshed = await refreshBrowserSession(auth, request)
    accessToken = refreshed?.accessToken ?? ''
  }
  if (!accessToken) {
    const response = NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    clearSessionCookies(response, request)
    return response
  }

  let upstream = await authFetch(auth, suffix, request, { accessToken, body: requestBody })
  if (upstream.status === 401 || upstream.status === 403) {
    refreshed = await refreshBrowserSession(auth, request)
    if (refreshed) {
      accessToken = refreshed.accessToken
      upstream = await authFetch(auth, suffix, request, { accessToken, body: requestBody })
    }
  }
  const data = await decode(upstream)
  const response = NextResponse.json(data, { status: upstream.status })
  if (refreshed) setSessionCookies(response, accessToken, refreshed.refreshToken)
  if (data.sign_in_again === true) clearSessionCookies(response, request)
  if (upstream.status === 401 || upstream.status === 403) clearSessionCookies(response, request)
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response
}

export const GET = proxyBrowserAccount
export const POST = proxyBrowserAccount
export const PATCH = proxyBrowserAccount
export const DELETE = proxyBrowserAccount
export const OPTIONS = proxyBrowserAccount