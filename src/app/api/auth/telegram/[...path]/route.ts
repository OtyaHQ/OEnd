import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'
import { PUBLIC_URLS } from '@/lib/public-urls'

export const dynamic = 'force-dynamic'

const PUBLIC_PREFIX = '/api/auth/telegram/'
const AUTH_PREFIX = '/auth/telegram/'

type AuthService = { fetch(request: Request): Promise<Response> }
type Payload = Record<string, unknown> & {
  provider_mode?: 'oidc' | 'widget'
  bot_username?: string
  widget_auth_url?: string
  access_token?: string
  refresh_token?: string
  authenticated?: boolean
}

function withoutSessionMaterial(data: Payload): Payload {
  const safe = { ...data }
  // Telegram is never permitted to create or deliver a browser session.
  delete safe.access_token
  delete safe.refresh_token
  delete safe.authenticated
  return safe
}

function safeWidgetAuthorizationUrl(request: NextRequest, data: Payload): string | null {
  if (data.provider_mode !== 'widget'
    || typeof data.bot_username !== 'string'
    || typeof data.widget_auth_url !== 'string') return null
  if (!/^[A-Za-z0-9_]{5,32}$/.test(data.bot_username)) return null

  let callback: URL
  try {
    callback = new URL(data.widget_auth_url)
  } catch {
    return null
  }

  const publicUrl = new URL(request.url)
  if (callback.protocol !== 'https:'
    || !PUBLIC_URLS.allowedOrigins.includes(callback.origin)
    || callback.pathname !== '/api/auth/telegram/widget/callback'
    || !callback.searchParams.get('state')) return null

  const page = new URL('/telegram-login', publicUrl)
  page.searchParams.set('bot', data.bot_username)
  page.searchParams.set('auth', callback.toString())
  return page.toString()
}

async function forward(request: NextRequest): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const auth = (env as Record<string, unknown>).AUTH as AuthService | undefined
    if (!auth?.fetch) {
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const publicUrl = new URL(request.url)
    if (!publicUrl.pathname.startsWith(PUBLIC_PREFIX)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const authUrl = new URL(publicUrl)
    authUrl.pathname = `${AUTH_PREFIX}${publicUrl.pathname.slice(PUBLIC_PREFIX.length)}`

    const headers = new Headers(request.headers)
    headers.delete('X-Otya-Turnstile')
    headers.set('X-OTYA-Public-Auth-Route', publicUrl.pathname)
    headers.set('X-OTYA-Public-Origin', publicUrl.origin)

    // Account linking is allowed only after the user already has an Otya
    // Account session. The token is forwarded to the auth service for
    // verification; this proxy never issues, refreshes, or sets a session.
    const accessToken = request.cookies.get('__Secure-otya_access')?.value
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    const upstream = await auth.fetch(new Request(authUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    }))

    const contentType = upstream.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) return upstream

    const data = await upstream.clone().json().catch(() => null) as Payload | null
    if (!data || typeof data !== 'object' || Array.isArray(data)) return upstream

    // An accidental legacy response containing tokens is stripped. This is
    // a final defense, not the primary authorization rule: the auth Worker
    // itself rejects Telegram login and Mini App session creation.
    const safeData = withoutSessionMaterial(data)

    if (publicUrl.pathname.endsWith('/start') && upstream.ok) {
      const authorizationUrl = safeWidgetAuthorizationUrl(request, safeData)
      return NextResponse.json(
        authorizationUrl
          ? { ...safeData, authorization_url: authorizationUrl }
          : safeData,
        { status: upstream.status, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    return NextResponse.json(safeData, {
      status: upstream.status,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (error) {
    console.error('[telegram-account-link]', (error as Error)?.name || 'UnknownError')
    return NextResponse.json(
      {
        error: 'Telegram account linking is temporarily unavailable',
        code: 'TELEGRAM_LINK_UNAVAILABLE',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

export const GET = forward
export const POST = forward
export const OPTIONS = forward
