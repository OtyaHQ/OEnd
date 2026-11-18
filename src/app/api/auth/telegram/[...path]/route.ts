import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'


export const dynamic = 'force-dynamic'

const PUBLIC_PREFIX = '/api/auth/telegram/'
const AUTH_PREFIX = '/auth/telegram/'
const ACCESS_COOKIE = '__Secure-otya_access'

type AuthService = { fetch(request: Request): Promise<Response> }
type Payload = Record<string, unknown> & {
  telegram_login?: boolean
  authenticated?: boolean
  access_token?: string
  refresh_token?: string
  provider_mode?: 'oidc' | 'widget'
  bot_username?: string
  widget_auth_url?: string
}

function safeWidgetPage(request: NextRequest, data: Payload): string | null {
  if (data.provider_mode !== 'widget' || typeof data.bot_username !== 'string' || typeof data.widget_auth_url !== 'string') return null
  if (!/^[A-Za-z0-9_]{5,32}$/.test(data.bot_username)) return null
  let callback: URL
  try { callback = new URL(data.widget_auth_url) } catch { return null }
  if (callback.protocol !== 'https:' || callback.hostname !== 'petersmartlink.com' || callback.pathname !== '/api/auth/telegram/widget/callback' || !callback.searchParams.get('state')) return null
  const page = new URL('/telegram-login', request.url)
  page.searchParams.set('bot', data.bot_username)
  page.searchParams.set('auth', callback.toString())
  return page.toString()
}
function withoutTokens(data: Payload) {
  const safe = { ...data }
  delete safe.access_token
  delete safe.refresh_token
  return safe
}

async function forward(request: NextRequest): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const auth = (env as Record<string, unknown>).AUTH as AuthService | undefined
    if (!auth?.fetch) return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

    const publicUrl = new URL(request.url)
    if (!publicUrl.pathname.startsWith(PUBLIC_PREFIX)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const authUrl = new URL(request.url)
    authUrl.pathname = `${AUTH_PREFIX}${publicUrl.pathname.slice(PUBLIC_PREFIX.length)}`
    const headers = new Headers(request.headers)
    headers.set('X-OTYA-Public-Auth-Route', publicUrl.pathname)
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value
    if (accessToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${accessToken}`)

    const upstream = await auth.fetch(new Request(authUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    }))

    const contentType = upstream.headers.get('content-type') || ''
    const data = contentType.includes('application/json') ? await upstream.clone().json().catch(() => ({})) as Payload : null

    if (publicUrl.pathname.endsWith('/miniapp') && data) {
      // Never upgrade a Telegram response into a browser session. Even if an
      // older handler accidentally returns bearer tokens, strip them.
      return NextResponse.json(withoutTokens(data), {
        status: upstream.status,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    if (publicUrl.pathname.endsWith('/start') && upstream.ok && data) {
      const widgetPage = safeWidgetPage(request, data)
      const response = NextResponse.json(widgetPage ? { ...data, authorization_url: widgetPage } : data, {
        status: upstream.status,
        headers: { 'Cache-Control': 'no-store' },
      })
      return response
    }

    return upstream
  } catch (error) {
    console.error('[telegram-auth-proxy]', (error as Error)?.message)
    return NextResponse.json({ error: 'Telegram Sign-In is temporarily unavailable', code: 'TELEGRAM_LOGIN_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

export const GET = forward
export const POST = forward
export const OPTIONS = forward
