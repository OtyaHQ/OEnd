import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('browser auth defaults to OTYA Space and only accepts safe same-site return paths', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  assert.match(signIn, /DEFAULT_AFTER_AUTH = 'https:\/\/space\.petersmartlink\.com\/'/)
  assert.match(signIn, /requested\.startsWith\('\/'\)/)
  assert.match(signIn, /!requested\.startsWith\('\/\/'\)/)
  assert.match(signIn, /!requested\.includes\('\\\\'\)/)
  assert.match(signIn, /window\.location\.replace\(afterAuthDestination\(\)\)/)
})

test('Telegram is not a primary sign-in provider; linking requires an existing Otya session', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  const telegram = read('auth-worker/src/telegram-login.ts')
  assert.doesNotMatch(signIn, /Continue with Telegram/)
  assert.doesNotMatch(signIn, /\/api\/auth\/telegram\/start\?mode=login/)
  assert.match(telegram, /requested === 'login' \|\| requested === 'admin'/)
  assert.match(telegram, /const userId = await requireUser\(request, env\)/)
  assert.match(signIn, /Continue with Google/)
})

test('Google-created accounts receive clear mobile sign-in guidance', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  assert.match(signIn, /Google accounts may not have an Otya password yet\./)
  assert.match(signIn, /If you created this account with Google, use that same method below\./)
  assert.match(signIn, /type: 'standard'/)
  assert.match(signIn, /shape: 'pill'/)
  assert.doesNotMatch(signIn, /<span>Continue with Telegram<\/span>/)
})

test('admin uses unified OTYA identity but keeps separate elevated MFA', () => {
  const admin = read('src/lib/admin_auth.ts')
  const session = read('src/app/api/admin/session/route.ts')
  assert.match(admin, /ACCOUNT_ACCESS_COOKIE = '__Secure-otya_access'/)
  assert.match(admin, /COOKIE_NAME = 'otya_admin_session'/)
  assert.match(session, /\/auth\/admin\/start/)
  assert.match(session, /\/auth\/admin\/verify-otp/)
  assert.match(session, /\/auth\/admin\/consume/)
})
