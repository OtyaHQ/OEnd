const LINK_PROOF_TTL = 5 * 60

/**
 * Consume a one-use email proof before a legacy Telegram identity can be
 * linked or replaced. The proof is bound to the current verified email.
 */
export async function consumeVerifiedTelegramIdentityLink({ kv, userId, currentEmail }) {
  const email = String(currentEmail ?? '').trim().toLowerCase()
  if (!email) return false
  const key = `telegram_identity_link_verified:${userId}`
  const storedEmail = await kv.get(key)
  await kv.delete(key)
  return storedEmail === email
}

export { LINK_PROOF_TTL }
