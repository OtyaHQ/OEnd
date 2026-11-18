import type { D1Database } from './db'

export interface TelegramPrimaryLoginEnv {
  AUTH_DB: D1Database
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/**
 * Compatibility guard for the retired Telegram identity-login endpoints.
 * Telegram may be linked after normal Otya authentication, but it must never
 * create an account or issue an Otya browser session.
 */
export async function handleTelegramPrimaryLogin(request: Request, _env: TelegramPrimaryLoginEnv): Promise<Response | null> {
  const url = new URL(request.url)
  const isLoginStart = url.pathname === '/auth/telegram/start' && url.searchParams.get('mode') === 'login'
  const isLoginCallback = url.pathname === '/auth/telegram/callback'
  if (!isLoginStart && !isLoginCallback) return null

  return json({
    error: 'Telegram sign-in is disabled. Use your Otya email or Google account, then connect Telegram from Account settings.',
    code: 'TELEGRAM_LOGIN_DISABLED',
  }, 410)
}
