// lib/response.ts
// Consistent JSON responses and security headers.
//
// CORS is not globally enabled here. Same-origin browser calls do not need it,
// and a fixed allow-origin header would bind the API to one brand domain.
// Cross-origin integrations must opt in at their route boundary with a
// validated, product-specific origin allowlist.

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
      'Cache-Control': options.cache ?? 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      ...(options.source ? { 'X-Theme-Source': options.source } : {}),
    },
  })
}

export function errorJson(message: string, status = 400): Response {
  return secureJson({ error: message }, { status })
}
