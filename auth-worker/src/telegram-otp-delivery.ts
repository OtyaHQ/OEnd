import type { D1Database } from './db'

type CoreBinding = { fetch(request: Request): Promise<Response> }

export interface TelegramOtpDeliveryEnv {
  AUTH_DB: D1Database
  CORE?: CoreBinding
  INTERNAL_SECRET?: string
}

export async function getTelegramOtpChatId(db: D1Database, userId: string): Promise<string | null> {
  const row = await db.prepare(
    "SELECT provider_subject FROM linked_identities WHERE user_id = ? AND provider = 'telegram_otp_bot' LIMIT 1",
  ).bind(userId).first<{ provider_subject?: string }>()
  const chatId = String(row?.provider_subject ?? '').trim()
  return /^[1-9][0-9]{3,15}$/.test(chatId) ? chatId : null
}

/** Sends an OTP only to the private bot chat explicitly linked to this Otya account. */
export async function sendTelegramOtp(
  env: TelegramOtpDeliveryEnv,
  chatId: string,
  code: string,
  purpose: string,
): Promise<void> {
  if (!env.CORE?.fetch || !env.INTERNAL_SECRET) {
    throw new Error('Otya Telegram delivery service is unavailable')
  }
  const response = await env.CORE.fetch(new Request('https://otya-core/internal/telegram/otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTYA-Internal-Secret': env.INTERNAL_SECRET,
      'X-OTYA-Service': 'otya-auth',
    },
    body: JSON.stringify({ chat_id: chatId, code, purpose }),
    signal: AbortSignal.timeout(8000),
  }))
  if (!response.ok) throw new Error('Telegram security code delivery failed')
}
