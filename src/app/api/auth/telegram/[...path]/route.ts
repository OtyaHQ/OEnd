import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'


export const dynamic = 'force-dynamic'

const PUBLIC_PREFIX = '/api/auth/telegram/'
const AUTH_PREFIX = '/auth/telegram/'
const ADMIN_RETURN_COOKIE = 'otya_admin_return'
const COOKIE_DOMAIN = '.petersmartlink.com'
const SPACE_URL = 'https://space.petersmartlink.com/'
const ADMIN_RETURN_MAX_AGE = 10 * 60

type AuthService = { fetch(request: Request): Promise<Response> }
type Payload = Record<string, unknown> & {
  telegram_login?: boolean
  admin_mfa?: boolean
  authenticated?: boolean
  provider_mode?: 'oidc' | 'widget'
  bot_username?: string
  widget_auth_url?: string
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: true, sameSite: 'lax' as const, domain: COOKIE_DOMAIN, path: '/', maxAge }
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
function safeAdminReturn(publicUrl: URL): string | null {
  if (publicUrl.searchParams.get('mode') !== 'admin' || publicUrl.searchParams.get('return_to') !== 'sign-in') return null
  const target = new URL('/sign-in', publicUrl)
  target.searchParams.set('owner', 'verified')
  const next = publicUrl.searchParams.get('next')?.trim() ?? ''
  if ((next === '/admin' || next.startsWith('/admin/')) && !next.includes('\\') && !next.startsWith('//')) target.searchParams.set('next', next)
  return `${target.pathname}${target.search}`
}
function setAdminReturn(response: NextResponse, path: string | null) {
  if (path) response.cookies.set(ADMIN_RETURN_COOKIE, path, cookieOptions(ADMIN_RETURN_MAX_AGE))
}
function clearAdminReturn(response: NextResponse) {
  response.cookies.set(ADMIN_RETURN_COOKIE, '', { ...cookieOptions(0), expires: new Date(0) })
}
function callbackAdminReturn(request: NextRequest): string {
  const value = request.cookies.get(ADMIN_RETURN_COOKIE)?.value ?? ''
  if (value.startsWith('/sign-in?owner=verified')) return value
  return '/admin?telegram=verified'
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
    headers.delete('X-Otya-Turnstile')
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
      // Mini App identity data may confirm that the request came from Telegram,
      // but it must never mint browser Otya sessions or set login cookies.
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
      setAdminReturn(response, safeAdminReturn(publicUrl))
      return response
    }

    if (publicUrl.pathname.endsWith('/callback') && upstream.ok && data
      && data.admin_mfa === true && data.telegram_verified === true) {
      // Telegram may complete only the elevated owner-verification ceremony.
      // It can never set the normal Otya account access or refresh cookies.
      const response = NextResponse.redirect(new URL(callbackAdminReturn(request), SPACE_URL), 302)
      clearAdminReturn(response)
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
    return upstream
  } catch (error) {
    console.error('[telegram-auth-proxy]', (error as Error)?.message)
    return NextResponse.json({ error: 'Telegram security verification is temporarily unavailable', code: 'TELEGRAM_LOGIN_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

export const GET = forward
export const POST = forward
export const OPTIONS = forward
