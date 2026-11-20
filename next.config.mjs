/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === 'development'

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '0',
  },
  {
    key: 'X-Permitted-Cross-Domain-Policies',
    value: 'none',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
  },
  {
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-site',
  },
  {
    key: 'Origin-Agent-Cluster',
    value: '?1',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://telegram.org https://challenges.cloudflare.com https://pagead2.googlesyndication.com https://partner.googleadservices.com https://tpc.googlesyndication.com"
        : "script-src 'self' 'unsafe-inline' https://accounts.google.com https://telegram.org https://challenges.cloudflare.com https://pagead2.googlesyndication.com https://partner.googleadservices.com https://tpc.googlesyndication.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://challenges.cloudflare.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: https://pagead2.googlesyndication.com",
      "connect-src 'self' https://otya.site https://accounts.google.com https://telegram.org https://oauth.telegram.org https://challenges.cloudflare.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.google-analytics.com",
      "frame-src https://accounts.google.com https://oauth.telegram.org https://challenges.cloudflare.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
]

const noStoreHeaders = [
  {
    key: 'Cache-Control',
    value: 'private, no-store, no-cache, max-age=0, must-revalidate',
  },
]

const nextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  async headers() {
    return [
      {
        source: '/sign-in/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/account/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/telegram-login/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/admin/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
