/** Returns true only for the owner-only Telegram step-up response. */
export function isOwnerTelegramCallback(data) {
  return Boolean(data && typeof data === 'object' && data.admin_mfa === true)
}
