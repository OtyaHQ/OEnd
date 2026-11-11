import type { D1Database } from './db'

export type SecretsStoreSecret = { get(): Promise<string> }

export interface TelegramOtpEnv {
  AUTH_DB: D1Database
  TELEGRAM_BOT_TOKEN?: string | SecretsStoreSecret
}

/**
 * Telegram is an OTP delivery channel for an already-authenticated Otya
 * account. A linked Telegram identity never creates or upgrades an Otya
 * session. Delivery is best-effort because a user must have opened the bot
 * before Telegram permits direct messages.
 */
export async function sendLinkedTelegramOtp(
  env: TelegramOtpEnv,
  userId: string,
  code: string,
  purpose: string,
): Promise<boolean> {
  const linked = await env.AUTH_DB.prepare(
    "SELECT provider_subject FROM linked_identities WHERE provider = 'telegram' AND user_id = ? LIMIT 1",
  ).bind(userId).first<{ provider_subject?: string }>()

  const chatId = linked?.provider_subject?.trim() ?? ''
  if (!/^\d{4,24}$/.test(chatId)) return false

  const configured = env.TELEGRAM_BOT_TOKEN
  let token = ''
  if (typeof configured === 'string') token = configured.trim()
  else if (configured && typeof configured.get === 'function') {
    try { token = (await configured.get()).trim() } catch { return false }
  }
  if (!token) return false

  const safePurpose = purpose.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 100)
  const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: [
        'Otya security code',
        '',
        code,
        '',
        'Purpose: ' + (safePurpose || 'Account verification'),
        'This code expires in 10 minutes. Never share it with anyone.',
        'This message does not sign you in. Use the code only inside Otya.',
      ].join('\n'),
      protect_content: true,
    }),
    signal: AbortSignal.timeout(5000),
  })
  const result = await response.json().catch(() => ({})) as { ok?: boolean }
  return response.ok && result.ok === true
}
