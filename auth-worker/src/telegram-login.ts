/**
 * Telegram account identity authentication has been retired.
 * Telegram is reserved for one-time-code delivery through the private Otya bot.
 * Authenticated Mini App support is handled by telegram-miniapp.ts separately.
 */
export interface TelegramLoginEnv {}

function retired(): Response {
  return new Response(JSON.stringify({
    error: 'Telegram account sign-in and Telegram identity linking are retired. Use Otya email or Google; Telegram is only an OTP delivery channel.',
    code: 'TELEGRAM_LOGIN_RETIRED',
  }), {
    status: 410,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function handleTelegramLogin(request: Request, _env?: TelegramLoginEnv): Promise<Response | null> {
  const pathname = new URL(request.url).pathname
  if (!pathname.startsWith('/auth/telegram/')) return null
  if (pathname === '/auth/telegram/miniapp') return null
  return retired()
}
