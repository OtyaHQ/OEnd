import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOtyaPointProxyRequest, otyaPointUpstreamPath } from '@/lib/otya-point-proxy-policy.mjs'

export const dynamic = 'force-dynamic'

const ACCESS_COOKIE = '__Secure-otya_access'
const REFRESH_COOKIE = '__Secure-otya_refresh'
const COOKIE_DOMAIN = '.petersmartlink.com'
const ACCESS_MAX_AGE = 15 * 60
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60
const MAX_BODY_BYTES = 64 * 1024

type ServiceBinding = { fetch(request: Request): Promise<Response> }
type RefreshResult = { accessToken: string; refreshToken: string }

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    domain: COOKIE_DOMAIN,
    path: '/',
    maxAge,
  }
}

function json(data: unknown, status: number) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

async function bindings() {
  const { env } = await getCloudflareContext({ async: true })
  const values = env as Record<string, unknown>
  return {
    auth: values.AUTH as ServiceBinding | undefined,
    point: values.OTYAPOINT_API as ServiceBinding | undefined,
  }
}

async function refreshSession(auth: ServiceBinding, request: NextRequest): Promise<RefreshResult | null> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value ?? ''
  if (!refreshToken) return null
  try {
    const response = await auth.fetch(new Request('https://auth/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(8000),
    }))
    if (!response.ok) return null
    const data = await response.json().catch(() => ({})) as Record<string, unknown>
    const accessToken = typeof data.access_token === 'string' ? data.access_token : ''
    const rotatedRefresh = typeof data.refresh_token === 'string' ? data.refresh_token : ''
    return accessToken && rotatedRefresh ? { accessToken, refreshToken: rotatedRefresh } : null
  } catch {
    return null
  }
}

function updateCookies(response: NextResponse, tokens: RefreshResult) {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(ACCESS_MAX_AGE))
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(REFRESH_MAX_AGE))
}

function clearCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, '', { ...cookieOptions(0), expires: new Date(0) })
  response.cookies.set(REFRESH_COOKIE, '', { ...cookieOptions(0), expires: new Date(0) })
}

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    const { path } = await context.params
    const upstreamPath = otyaPointUpstreamPath(Array.isArray(path) ? path : [])
    if (!upstreamPath) return json({ error: 'A valid OtyaPoint API path is required.' }, 400)

    const url = new URL(request.url)
    if (!isAllowedOtyaPointProxyRequest({
      method: request.method,
      origin: request.headers.get('origin'),
      requestOrigin: url.origin,
      secFetchSite: request.headers.get('sec-fetch-site'),
    })) {
      return json({ error: 'This OtyaPoint request must come from the same origin.' }, 403)
    }

    if (request.method !== 'GET' && request.method !== 'HEAD'
      && request.headers.get('content-length')
      && Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
      return json({ error: 'Request body is too large.' }, 413)
    }

    const { auth, point } = await bindings()
    if (!auth?.fetch || !point?.fetch) {
      return json({ error: 'OtyaPoint services are temporarily unavailable.' }, 503)
    }

    let accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? ''
    let refreshed: RefreshResult | null = null
    if (!accessToken) {
      refreshed = await refreshSession(auth, request)
      accessToken = refreshed?.accessToken ?? ''
    }
    if (!accessToken) {
      const response = json({ error: 'Sign in to your Otya account to access OtyaPoint.' }, 401)
      clearCookies(response)
      return response
    }

    const method = request.method.toUpperCase()
    let body: ArrayBuffer | undefined
    if (method !== 'GET' && method !== 'HEAD') {
      body = await request.arrayBuffer()
      if (body.byteLength > MAX_BODY_BYTES) return json({ error: 'Request body is too large.' }, 413)
    }

    const target = new URL(upstreamPath + url.search, 'https://otyapoint-api')
    const callPoint = (token: string) => {
      const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${token}` })
      const contentType = request.headers.get('content-type')
      if (contentType) headers.set('Content-Type', contentType)
      const idempotencyKey = request.headers.get('idempotency-key')
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)
      return point.fetch(new Request(target, {
        method,
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(12000),
      }))
    }

    let upstream = await callPoint(accessToken)
    if (upstream.status === 401 && !refreshed) {
      refreshed = await refreshSession(auth, request)
      if (refreshed) {
        accessToken = refreshed.accessToken
        upstream = await callPoint(accessToken)
      }
    }

    const headers = new Headers()
    for (const name of ['content-type', 'retry-after', 'x-request-id']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    headers.set('Cache-Control', 'private, no-store')
    headers.set('X-Content-Type-Options', 'nosniff')
    const response = new NextResponse(upstream.body, { status: upstream.status, headers })
    if (refreshed) updateCookies(response, refreshed)
    if (upstream.status === 401) clearCookies(response)
    return response
  } catch (error) {
    console.error('[otya-point-gateway]', (error as Error)?.message)
    return json({ error: 'OtyaPoint is temporarily unavailable.' }, 503)
  }
}

export const GET = forward
export const HEAD = forward
export const POST = forward
export const PATCH = forward
export const DELETE = forward
