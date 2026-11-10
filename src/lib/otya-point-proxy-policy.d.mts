export type OtyaPointProxyPolicyInput = {
  method: string
  origin: string | null
  requestOrigin: string
  secFetchSite: string | null
}
export function isAllowedOtyaPointProxyRequest(input: OtyaPointProxyPolicyInput): boolean
export function otyaPointUpstreamPath(parts: string[]): string | null
