export interface VerifiedEmailChangeCommit {
  revokeSessions: () => Promise<void>
  updatePrimaryEmail: () => Promise<{ updated: boolean }>
}
export interface VerifiedEmailChangeResult {
  updated: boolean
  sessionsRevoked: boolean
  updateError?: unknown
  revocationError?: unknown
}
export function commitVerifiedEmailChange(options: VerifiedEmailChangeCommit): Promise<VerifiedEmailChangeResult>
