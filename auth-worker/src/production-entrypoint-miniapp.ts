import worker from './production-entrypoint'
import { handleTelegramMiniApp } from './telegram-miniapp'
import { handleTelegramPrimaryLogin, type TelegramPrimaryLoginEnv } from './telegram-primary-login'
import { createRefreshSafeKv } from './refresh-token-store'

type AuthEnv = Parameters<typeof worker.fetch>[1] & TelegramPrimaryLoginEnv & {
  TELEGRAM_MINIAPP_BOT_TOKEN?: unknown
}

export default {
  ...worker,
  async fetch(request: Request, env: Parameters<typeof worker.fetch>[1]): Promise<Response> {
    const rawEnv = env as AuthEnv
    // Apply one refresh-token storage boundary before any provider-specific
    // handler runs. New refresh credentials are indexed only by SHA-256 digest;
    // legacy raw-key sessions remain readable until their original KV TTL ends.
    const authEnv = {
      ...rawEnv,
      AUTH_KV: createRefreshSafeKv(rawEnv.AUTH_KV),
    } as AuthEnv
    const url = new URL(request.url)

    if (url.pathname === '/auth/telegram/miniapp') {
      const miniEnv = {
        ...authEnv,
        TELEGRAM_BOT_TOKEN: authEnv.TELEGRAM_MINIAPP_BOT_TOKEN,
      }
      const response = await handleTelegramMiniApp(request, miniEnv as Parameters<typeof handleTelegramMiniApp>[1])
      if (response) return response
    }

    // Telegram account identity sign-in and OIDC linking are retired. Only
    // the private bot OTP delivery channel remains; Mini App is handled above
    // under an existing authenticated Otya account session.
    const primaryLogin = await handleTelegramPrimaryLogin(request, authEnv)
    if (primaryLogin) return primaryLogin

    // Link/admin/widget compatibility routes remain on the established worker.
    return worker.fetch(request, authEnv)
  },
}
