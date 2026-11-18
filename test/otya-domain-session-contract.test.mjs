import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const sessionRoute = read('src/app/api/account-session/[...path]/route.ts')
const signIn = read('src/app/sign-in/page.tsx')
const authWorker = read('auth-worker/src/index.ts')
const authWrapper = read('auth-worker/src/entrypoint.ts')
const authConfig = read('auth-worker/wrangler.toml')

test('browser session cookies follow the request domain family during migration', () => {
  assert.ok(sessionRoute.includes("hostname === 'otya.site'"))
  assert.ok(sessionRoute.includes("hostname.endsWith('.otya.site')"))
  assert.ok(sessionRoute.includes("return '.otya.site'"))
  assert.ok(sessionRoute.includes("hostname === 'petersmartlink.com'"))
  assert.ok(sessionRoute.includes("hostname.endsWith('.petersmartlink.com')"))
  assert.ok(sessionRoute.includes("return '.petersmartlink.com'"))
  assert.ok(sessionRoute.includes('function cookieOptions(maxAge: number, request: NextRequest)'))
  assert.ok(sessionRoute.includes('clearSessionCookies(response, request)'))
  assert.ok(sessionRoute.includes('setSessionCookies(response, accessToken, refreshToken, request)'))
  assert.ok(!sessionRoute.includes("const COOKIE_DOMAIN = '.petersmartlink.com'"))
})

test('sign-in returns users to the canonical Otya Space hostname', () => {
  assert.ok(signIn.includes("const DEFAULT_AFTER_AUTH = 'https://space.otya.site/'"))
  assert.ok(!signIn.includes('created this account with Google or Telegram'))
})

test('Auth CORS allows canonical Otya web hosts and retains legacy compatibility', () => {
  for (const origin of [
    'https://otya.site',
    'https://www.otya.site',
    'https://space.otya.site',
    'https://petersmartlink.com',
    'https://www.petersmartlink.com',
  ]) assert.ok(authWorker.includes(`'${origin}'`), `missing CORS origin ${origin}`)
  assert.ok(authWorker.includes("const PRIMARY_ORIGIN = 'https://otya.site'"))
  assert.ok(authWrapper.includes("const PRIMARY_ORIGIN = 'https://otya.site'"))
  assert.ok(authConfig.includes('CORS_ORIGIN = "https://otya.site"'))
})
