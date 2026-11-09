import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))
const nextConfig = read('next.config.mjs')
const securityWorkflow = read('.github/workflows/security.yml')
const auditRetry = read('scripts/npm-audit-retry.mjs')

test('public server version remains Otya 1.0.0 during first-release evolution', () => {
  assert.equal(pkg.version, '1.0.0')
})

test('critical deployment stack is pinned instead of floating across deploys', () => {
  assert.equal(pkg.engines.node, '>=22 <23')
  assert.equal(pkg.dependencies.next, '15.5.28')
  assert.equal(pkg.dependencies.react, '19.2.8')
  assert.equal(pkg.dependencies['react-dom'], '19.2.8')
  assert.equal(pkg.devDependencies['@opennextjs/cloudflare'], '1.20.6')
  assert.equal(pkg.devDependencies.wrangler, '4.159.0')
  assert.equal(pkg.devDependencies.typescript, '5.9.3')
  assert.equal(pkg.devDependencies.postcss, '8.5.25')
  assert.equal(pkg.overrides.postcss, '8.5.25')
  assert.equal(pkg.overrides.sharp, '0.35.5')
  assert.doesNotMatch(pkg.dependencies.next, /^16\./)

  for (const path of ['package-lock.json', 'auth-worker/package-lock.json', 'ai-worker/package-lock.json']) {
    const lock = JSON.parse(read(path))
    assert.equal(lock.packages['node_modules/wrangler'].version, '4.159.0', `${path} must lock Wrangler 4.159.0`)
  }

  for (const path of ['wrangler.toml', 'auth-worker/wrangler.toml', 'ai-worker/wrangler.toml']) {
    assert.match(read(path), /compatibility_date = "2026-11-09"/)
  }
})

test('high-severity dependency audits are deployment gates', () => {
  assert.match(securityWorkflow, /npm ci --ignore-scripts/)
  assert.doesNotMatch(securityWorkflow, /--no-package-lock/)
  assert.match(
    securityWorkflow,
    /node (?:\.\.\/)?scripts\/npm-audit-retry\.mjs --audit-level=high/,
  )
  assert.match(auditRetry, /const args = \['audit'/)
  assert.match(auditRetry, /const maxAttempts = 3/)
  assert.match(
    auditRetry,
    /503 Service Unavailable\|502 Bad Gateway\|504 Gateway Timeout/,
  )
  assert.match(auditRetry, /ECONNRESET\|ETIMEDOUT\|EAI_AGAIN/)
  assert.match(auditRetry, /if \(!transient \|\| attempt === maxAttempts\)/)
  assert.match(auditRetry, /process\.exit\(result\.status \?\? 1\)/)
  assert.match(securityWorkflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\.0\.1/)
  assert.match(securityWorkflow, /actions\/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7\.1\.0/)
})

test('public web security headers keep HSTS at Cloudflare and browser isolation in app', () => {
  assert.doesNotMatch(nextConfig, /Strict-Transport-Security/)
  assert.match(nextConfig, /X-Content-Type-Options/)
  assert.match(nextConfig, /X-Permitted-Cross-Domain-Policies/)
  assert.match(nextConfig, /Cross-Origin-Opener-Policy/)
  assert.match(nextConfig, /Cross-Origin-Resource-Policy/)
  assert.match(nextConfig, /Origin-Agent-Cluster/)
  assert.match(nextConfig, /frame-ancestors 'none'/)
  assert.match(nextConfig, /object-src 'none'/)
})

test('sensitive browser surfaces remain explicitly non-cacheable', () => {
  for (const path of ['/sign-in/:path*', '/account/:path*', '/telegram-login/:path*', '/admin/:path*']) {
    assert.match(nextConfig, new RegExp(path.replace(/[.*+?^\{}$|()\[\]\\]/g, '\\$&')))
  }
  assert.match(nextConfig, /private, no-store, no-cache, max-age=0, must-revalidate/)
})
