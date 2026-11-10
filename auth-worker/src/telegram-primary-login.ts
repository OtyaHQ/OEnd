interface KVLike {
  get(key: string): Promise<string | null>
  delete(key: string): Promise<void>
}

export interface TelegramPrimaryLoginEnv {
  AUTH_KV: KVLike
}

const STATE_PREFIX = 'telegram_primary_oidc:'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

async function start(request: Request): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/auth/telegram/start' || url.searchParams.get('mode') !== 'login') return null
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  return json({
    error: 'Telegram is an Otya security-code channel, not a sign-in method. Use Google or email to sign in.',
    code: 'TELEGRAM_SIGN_IN_DISABLED',
  }, 403)
}

async function callback(request: Request, env: TelegramPrimaryLoginEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/auth/telegram/callback') return null
  const state = url.searchParams.get('state') || ''
  if (!state || !/^[A-Za-z0-9_-]{16,100}$/.test(state)) return null

  // Consume any outstanding legacy primary-login state without issuing an
  // Otya session. Owner verification uses a separate state namespace/handler.
  const key = `${STATE_PREFIX}${state}`
  const pending = await env.AUTH_KV.get(key)
  if (!pending) return null
  await env.AUTH_KV.delete(key)
  return Response.redirect('https://petersmartlink.com/sign-in?telegram=disabled', 302)
}

export async function handleTelegramPrimaryLogin(request: Request, env: TelegramPrimaryLoginEnv): Promise<Response | null> {
  const started = await start(request)
  if (started) return started
  return callback(request, env)
}
