import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('browser auth defaults to OTYA Space and only accepts safe same-site return paths', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  assert.match(signIn, /DEFAULT_AFTER_AUTH = '\/space\/'/)
  assert.match(signIn, /requested\.startsWith\('\/'\)/)
  assert.match(signIn, /!requested\.startsWith\('\/\/'\)/)
  assert.match(signIn, /!requested\.includes\('\\\\'\)/)
  assert.match(signIn, /window\.location\.replace\(afterAuthDestination\(\)\)/)
})

test('Telegram is not an Otya sign-in or account-creation provider', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  assert.doesNotMatch(signIn, /\/api\/auth\/telegram\/start\?mode=login/)
  assert.doesNotMatch(signIn, /Continue with Telegram|Sign in with Telegram/)
  assert.doesNotMatch(signIn, /disabled=\{busy \|\| registration\}/)
  assert.doesNotMatch(signIn, /account creation will be available after Telegram is linked/i)
})

test('provider-created accounts receive clear mobile sign-in guidance', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  assert.doesNotMatch(signIn, /Google or Telegram accounts may not have an Otya password yet/)
  assert.match(signIn, /Use Google if that is the method linked to your Otya Account/)
  assert.match(signIn, /type: 'standard'/)
  assert.match(signIn, /shape: 'pill'/)
  assert.doesNotMatch(signIn, /Continue with Telegram|Sign in with Telegram/)
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
