const LINK_PROOF_TTL = 5 * 60

export async function hashVerifiedTelegramEmail(value) {
  const email = String(value ?? '').trim().toLowerCase()
  if (!email) throw new Error('A verified email is required')
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email)))
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Atomically consumes the short-lived owner Telegram-link grant from D1.
 * A conditional DELETE ... RETURNING makes parallel requests single-use.
 * Only a hash of the verified email is stored in the proof table.
 */
export async function consumeVerifiedTelegramIdentityLink({ db, userId, currentEmail }) {
  const email = String(currentEmail ?? '').trim().toLowerCase()
  if (!email) return false
  const emailHash = await hashVerifiedTelegramEmail(email)
  const row = await db.prepare(`
    DELETE FROM telegram_identity_link_proofs
    WHERE user_id = ?
      AND email_hash = ?
      AND expires_at > datetime('now')
    RETURNING user_id
  `).bind(userId, emailHash).first()
  return Boolean(row)
}

export { LINK_PROOF_TTL }
