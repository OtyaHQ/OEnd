export type TelegramIdentityLinkProofKV = {
  get(key: string): Promise<string | null>
  delete(key: string): Promise<void>
}
export function consumeVerifiedTelegramIdentityLink(input: {
  kv: TelegramIdentityLinkProofKV
  userId: string
  currentEmail: string | null | undefined
}): Promise<boolean>
export const LINK_PROOF_TTL: number
