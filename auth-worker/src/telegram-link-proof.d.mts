export type TelegramIdentityLinkProofDB = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>
    }
  }
}
export function hashVerifiedTelegramEmail(value: string): Promise<string>
export function consumeVerifiedTelegramIdentityLink(input: {
  db: TelegramIdentityLinkProofDB
  userId: string
  currentEmail: string | null | undefined
}): Promise<boolean>
export const LINK_PROOF_TTL: number

export function consumeTelegramIdentityEmailChallenge(input: {
  db: TelegramIdentityLinkProofDB
  userId: string
  currentEmail: string | null | undefined
  otpDigest: string
}): Promise<boolean>
