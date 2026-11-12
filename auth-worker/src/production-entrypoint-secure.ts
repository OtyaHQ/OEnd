import worker from "./production-entrypoint";
import { createRefreshSafeKv } from "./refresh-token-store";

type AuthEnv = Parameters<typeof worker.fetch>[1];

function telegramSignInDisabled(): Response {
  return new Response(JSON.stringify({
    error: "telegram_sign_in_disabled",
    message: "Sign in with email OTP. Telegram is reserved for optional OTP delivery after account linking.",
  }), {
    status: 410,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  ...worker,
  async fetch(request: Request, env: AuthEnv) {
    const pathname = new URL(request.url).pathname.toLowerCase();
    const telegramSignInPath =
      pathname.startsWith("/auth/telegram") ||
      pathname.includes("/telegram/miniapp") ||
      pathname.includes("/telegram/primary-login");
    if (telegramSignInPath) return telegramSignInDisabled();

    const safeEnv = {
      ...env,
      AUTH_KV: createRefreshSafeKv(env.AUTH_KV),
    } as AuthEnv;
    return worker.fetch(request, safeEnv);
  },
};
