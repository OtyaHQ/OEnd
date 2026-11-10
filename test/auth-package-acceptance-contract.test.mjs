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

test('Google and email remain account sign-in methods while Telegram is reserved for security-code delivery', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  assert.match(signIn, /CONTINUE WITH GOOGLE/)
  assert.match(signIn, /Telegram is used only for security-code delivery/i)
  assert.doesNotMatch(signIn, /\/api\/auth\/telegram\/start\?mode=login/)
  assert.doesNotMatch(signIn, /Continue with Telegram/)
})

test('Google-connected accounts receive clear password recovery guidance', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  assert.match(signIn, /Google-connected accounts may not have an Otya password yet\./)
  assert.match(signIn, /Forgot password/)
  assert.match(signIn, /type: 'standard'/)
  assert.match(signIn, /shape: 'pill'/)
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
