import worker from './production-entrypoint'
import { createRefreshSafeKv } from './refresh-token-store'

type AuthEnv = Parameters<typeof worker.fetch>[1]

function disabledTelegramAuth(): Response {
  return new Response(JSON.stringify({
    error: 'Telegram cannot authenticate or create an Otya session. Sign in to Otya first, then link Telegram for OTP delivery and notifications.',
    code: 'TELEGRAM_LOGIN_DISABLED',
  }), {
    status: 410,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export default {
  ...worker,
  async fetch(request: Request, env: Parameters<typeof worker.fetch>[1]): Promise<Response> {
    const rawEnv = env as AuthEnv
    // Keep the refresh-token store boundary shared by all Otya Account routes.
    const authEnv = {
      ...rawEnv,
      AUTH_KV: createRefreshSafeKv(rawEnv.AUTH_KV),
    } as AuthEnv
    const url = new URL(request.url)

    // Telegram Mini Apps no longer establish a primary Otya identity.
    // Telegram remains a bot, notification and linked-account OTP channel.
    if (url.pathname === '/auth/telegram/miniapp') return disabledTelegramAuth()

    return worker.fetch(request, authEnv)
  },
}
