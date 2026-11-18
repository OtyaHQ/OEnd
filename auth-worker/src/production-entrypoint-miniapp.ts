import worker from './production-entrypoint'
import { handleTelegramMiniApp } from './telegram-miniapp'
import { createRefreshSafeKv } from './refresh-token-store'

type AuthEnv = Parameters<typeof worker.fetch>[1] & {
  TELEGRAM_MINIAPP_BOT_TOKEN?: unknown
}

export default {
  ...worker,
  async fetch(request: Request, env: Parameters<typeof worker.fetch>[1]): Promise<Response> {
    const rawEnv = env as AuthEnv
    const authEnv = {
      ...rawEnv,
      AUTH_KV: createRefreshSafeKv(rawEnv.AUTH_KV),
    } as AuthEnv
    const url = new URL(request.url)

    // Telegram Mini App is link-only. It requires an existing Otya bearer
    // session and cannot create an account or issue access/refresh tokens.
    if (url.pathname === '/auth/telegram/miniapp') {
      const miniEnv = {
        ...authEnv,
        TELEGRAM_BOT_TOKEN: authEnv.TELEGRAM_MINIAPP_BOT_TOKEN,
      }
      const response = await handleTelegramMiniApp(request, miniEnv as Parameters<typeof handleTelegramMiniApp>[1])
      if (response) return response
    }

    // The shared worker handles authenticated Telegram linking and rejects
    // login/admin modes. Telegram OIDC primary sign-in is not wired here.
    return worker.fetch(request, authEnv)
  },
}
