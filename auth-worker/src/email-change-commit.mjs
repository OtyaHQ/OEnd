/**
 * Commits a verified primary-email change and closes refresh-token race windows.
 */
export async function commitVerifiedEmailChange({ revokeSessions, updatePrimaryEmail }) {
  // Fail closed before changing the account email if existing sessions cannot be closed.
  await revokeSessions()

  let update
  try {
    update = await updatePrimaryEmail()
  } catch (updateError) {
    return { updated: false, sessionsRevoked: true, updateError }
  }

  if (!update?.updated) return { updated: false, sessionsRevoked: true }

  try {
    // Catch any session created between the first revocation and the D1 update.
    await revokeSessions()
    return { updated: true, sessionsRevoked: true }
  } catch (revocationError) {
    // The email is committed; report incomplete cleanup rather than imply rollback.
    return { updated: true, sessionsRevoked: false, revocationError }
  }
}
