import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const router = read('src/production-router.mjs')
const nextConfig = read('next.config.mjs')
const status = read('src/app/status/page.tsx')
const statusClient = read('src/app/status/StatusClient.tsx')

test('public host roles are configuration-driven rather than fixed to one apex', () => {
  assert.match(router, /function configuredHosts\(env, surface\)/)
  assert.match(router, /OTYA_\$\{surface\.toUpperCase\(\)\}_HOSTS/)
  assert.match(router, /function isSurfaceHost\(hostname, surface, env\)/)
  assert.match(router, /function resolveSurfaceHost\(hostname, surface, env\)/)
  assert.match(router, /function resolvePrimaryHost\(hostname, env\)/)
  assert.match(router, /configured\.find\(\(candidate\) => rootHost\(candidate\) === root\)/)
  assert.doesNotMatch(router, /const APP_HOST =/)
  assert.doesNotMatch(router, /const DOCS_HOST =/)
  assert.doesNotMatch(router, /const STATUS_HOST =/)
  assert.doesNotMatch(router, /const SPACE_HOST =/)
  assert.doesNotMatch(router, /petersmartlink\.com/)
})

test('routing recognizes primary, API, docs, status, Space and assets as independent surfaces', () => {
  assert.match(router, /configuredHosts\(env, 'primary'\)/)
  assert.match(router, /isApiHost\(host, env\)/)
  assert.match(router, /isSurfaceHost\(host, 'docs', env\)/)
  assert.match(router, /isSurfaceHost\(host, 'status', env\)/)
  assert.match(router, /isSurfaceHost\(host, 'space', env\)/)
  assert.ok(router.includes("['docs', 'status', 'space', 'www', 'api', 'assets']"))
})

test('surface routing preserves the requested hostname for browser cookies and origin checks', () => {
  assert.match(router, /async function dispatchSurface/)
  assert.match(router, /headers\.set\('X-Forwarded-Host', url\.hostname\)/)
  assert.match(router, /headers\.set\('X-Forwarded-Proto', 'https'\)/)
  assert.match(router, /target\.pathname = pathname/)
  assert.doesNotMatch(router.slice(router.indexOf('async function dispatchSurface'), router.indexOf('async function routeOtyaRequest')), /target\.hostname =/)
  assert.match(router, /function redirectToHost\(url, hostname, pathname\)/)
  assert.match(router, /target\.protocol = 'https:'/)
})

test('surface paths remain separated while sharing the same deployed app', () => {
  assert.match(router, /dispatchSurface\(request, url, env, ctx, '\/space\/'\)/)
  assert.match(router, /dispatchSurface\(request, url, env, ctx, '\/account\/'\)/)
  assert.match(router, /dispatchSurface\(request, url, env, ctx, '\/docs\/'\)/)
  assert.match(router, /dispatchSurface\(request, url, env, ctx, '\/help\/'\)/)
  assert.match(router, /dispatchSurface\(request, url, env, ctx, '\/status\/'\)/)
  assert.match(router, /url\.pathname === '\/api\/status'/)
})

test('Next trailing slash and forwarded-host behavior remain explicit', () => {
  assert.match(nextConfig, /trailingSlash:\s*true/)
  assert.match(router, /X-Forwarded-Host/)
  assert.match(router, /X-Forwarded-Proto/)
})

test('public status page exposes live state without internal infrastructure details', () => {
  assert.match(status, /Otya Status/)
  assert.match(status, /LiveStatusPanel/)
  assert.match(statusClient, /fetch\(['"]\/api\/status['"]/)
  assert.doesNotMatch(status + statusClient, /CLOUDFLARE_ACCOUNT_ID|INTERNAL_SECRET|D1 database|R2 bucket/)
})
