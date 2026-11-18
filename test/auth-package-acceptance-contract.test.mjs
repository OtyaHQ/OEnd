import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('browser auth defaults to Otya Space and only accepts safe same-site return paths', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  assert.match(signIn, /DEFAULT_AFTER_AUTH = 'https:\/\/space\.otya\.site\/'/)
  assert.match(signIn, /requested\.startsWith\('\/'\)/)
  assert.match(signIn, /!requested\.startsWith\('\/\/'\)/)
  assert.match(signIn, /!requested\.includes\('\\\\'\)/)
  assert.match(signIn, /window\.location\.replace\(afterAuthDestination\(\)\)/)
})

test('Telegram is not an account sign-in provider and remains only an owner step-up channel', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  const secure = read('auth-worker/src/production-entrypoint-secure.ts')
  const adminMfa = read('auth-worker/src/admin-mfa.ts')
  assert.doesNotMatch(signIn, /api\/auth\/telegram\/start\?mode=login/)
  assert.match(signIn, /mode === 'owner-telegram'/)
  assert.match(signIn, /https:\/\/t\.me\/OtyaPlayerBot\?start=owner_/)
  assert.match(signIn, /Open Otya Telegram bot/)
  assert.match(signIn, /I have confirmed in Telegram/)
  assert.doesNotMatch(signIn, /api\/auth\/telegram\/start/)
  assert.match(signIn, /action: 'complete'/)
  assert.match(secure, /telegramSignInDisabled/)
  assert.match(secure, /status: 410/)
  assert.match(adminMfa, /confirmAdminTelegramChallenge/)
  assert.match(adminMfa, /linked\.user_id !== userId/)
  assert.match(adminMfa, /INSERT INTO linked_identities/)
})

test('provider-created accounts receive clear email and Google sign-in guidance', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  assert.match(signIn, /Continue with Google or sign in with your Otya email and password/)
  assert.match(signIn, /Forgot password/)
  assert.match(signIn, /type: 'standard'/)
  assert.match(signIn, /shape: 'pill'/)
  assert.doesNotMatch(signIn, /If you created this account with Google or Telegram/)
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
