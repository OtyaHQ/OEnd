import { PUBLIC_URLS } from './public-urls'

import { NextRequest as _NextRequest } from 'next/server'

/**
 * HMAC-SHA256 request verification middleware.
 *
 * The Flutter app signs each request with HMAC-SHA256 using the shared secret
 * (OTYA_STORE_ADMIN_TOKEN). The signing string is "METHOD:PATH:TIMESTAMP".
 *
 * Expected headers from the Flutter app:
 *   X-Otya-Timestamp  — Unix timestamp in seconds (request time)
 *   X-Otya-Signature  — hex(HMAC-SHA256(secret, "METHOD:PATH:TIMESTAMP"))
 *
 * Rejects if:
 *   - Headers are missing
 *   - Timestamp is more than 5 minutes old (replay protection)
 *   - Signature does not match
 */
export interface AuthEnv {
  OTYA_STORE_ADMIN_TOKEN: string;
}

export async function verifyRequest(
  request: Request,
  env: AuthEnv,
): Promise<{ ok: boolean; error?: string }> {
  const timestamp = request.headers.get('X-Otya-Timestamp')
  const signature = request.headers.get('X-Otya-Signature')

  if (!timestamp || !signature) {
    return { ok: false, error: 'Missing auth headers' }
  }

  // Replay protection: reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000)
  const ts  = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    return { ok: false, error: 'Timestamp expired or invalid' }
  }

  // Build the signing string
  const url           = new URL(request.url)
  const signingString = `${request.method}:${url.pathname}:${timestamp}`

  // Compute expected HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.OTYA_STORE_ADMIN_TOKEN),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingString),
  )
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison
  if (!timingSafeEqual(expected, signature.toLowerCase())) {
    return { ok: false, error: 'Invalid signature' }
  }

  return { ok: true }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * CORS headers for Flutter-facing API routes.
 * Restricts Allow-Origin to the canonical domain.
 */
export const API_CORS = {
  'Access-Control-Allow-Origin':  PUBLIC_URLS.primary,
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-App-Token, X-Otya-Timestamp, X-Otya-Signature, X-Otya-Device-Id',
} as const
