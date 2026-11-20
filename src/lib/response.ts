// lib/response.ts
// Every API response goes through here to get consistent security headers.

export function secureJson(
  data: unknown,
  options: {
    status?: number;
    cache?: string;
    source?: string;
  } = {},
): Response {
  return new Response(JSON.stringify(data), {
    status: options.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Cache
      'Cache-Control': options.cache ?? 'no-store',
      // Security
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      // CORS — locked to the app's origin only
      'Access-Control-Allow-Origin': 'https://otya.site',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, X-Otya-Timestamp, X-Otya-Signature, X-Otya-Device-Id',
      // Diagnostics
      ...(options.source ? { 'X-Theme-Source': options.source } : {}),
    },
  })
}

export function errorJson(message: string, status = 400): Response {
  return secureJson({ error: message }, { status })
}
