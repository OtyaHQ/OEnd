import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ACCESS_COOKIE = '__Secure-otya_access'
const RETIRED = {
  error: 'Telegram account sign-in and identity linking are retired. Sign in with Otya email or Google; Telegram is only an OTP delivery channel.',
  code: 'TELEGRAM_LOGIN_RETIRED',
}

type AuthService = { fetch(request: Request): Promise<Response> }

async function forwardMiniApp(request: NextRequest): Promise<Response> {
  const url = new URL(request.url)
  if (!url.pathname.endsWith('/miniapp')) {
    return NextResponse.json(RETIRED, { status: 410, headers: { 'Cache-Control': 'no-store' } })
  }
  if (request.method !== 'POST' && request.method !== 'OPTIONS') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: { 'Cache-Control': 'no-store' } })
  }
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value
  if (!accessToken) {
    return NextResponse.json({ error: 'Sign in to Otya with email or Google first.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const { env } = await getCloudflareContext({ async: true })
    const auth = (env as Record<string, unknown>).AUTH as AuthService | undefined
    if (!auth?.fetch) return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    const authUrl = new URL(request.url)
    authUrl.pathname = '/auth/telegram/miniapp'
    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('X-OTYA-Public-Auth-Route', '/api/auth/telegram/miniapp')
    const upstream = await auth.fetch(new Request(authUrl, {
      method: request.method,
      headers,
      body: request.method === 'OPTIONS' ? undefined : request.body,
      redirect: 'manual',
    }))
    const contentType = upstream.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) return upstream
    const data = await upstream.json().catch(() => ({})) as Record<string, unknown>
    delete data.access_token
    delete data.refresh_token
    return NextResponse.json(data, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[telegram-miniapp-proxy]', (error as Error)?.message)
    return NextResponse.json({ error: 'Telegram Mini App service is temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

export const POST = forwardMiniApp
export const OPTIONS = forwardMiniApp
export const GET = forwardMiniApp
