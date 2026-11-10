const SAFE_METHODS = new Set(['GET'])
const WRITE_METHODS = new Set(['POST', 'PATCH'])
const ALLOWED_METHODS = new Set([...SAFE_METHODS, ...WRITE_METHODS])

/**
 * Enforce the same-origin browser boundary before any request is sent to the
 * private OtyaPoint service. Mutations require an exact Origin match.
 */
export function isAllowedOtyaPointProxyRequest({ method, origin, requestOrigin, secFetchSite }) {
  if (!ALLOWED_METHODS.has(String(method || '').toUpperCase())) return false
  if (origin && origin !== requestOrigin) return false
  if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) return false
  if (WRITE_METHODS.has(String(method || '').toUpperCase()) && origin !== requestOrigin) return false
  return true
}

/** Convert a Next catch-all route into a fixed /api path without traversal. */
export function otyaPointUpstreamPath(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return null
  if (parts.some(part => typeof part !== 'string' || !part || part === '.' || part === '..' || part.includes('/') || part.includes(String.fromCharCode(92)))) {
    return null
  }
  return '/api/' + parts.map(part => encodeURIComponent(part)).join('/')
}
