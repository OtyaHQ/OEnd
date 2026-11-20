export type OpointProxyPolicyInput = {
  method: string
  origin: string | null
  requestOrigin: string
  secFetchSite: string | null
}
export function isAllowedOpointProxyRequest(input: OpointProxyPolicyInput): boolean
export function opointUpstreamPath(parts: string[]): string | null
