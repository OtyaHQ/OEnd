import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const adminAuth = read('src/lib/admin_auth.ts')
const adminSession = read('src/app/api/admin/session/route.ts')
const signIn = read('src/app/sign-in/page.tsx')
const adminLayout = read('src/app/admin/layout.tsx')
const adminPage = read('src/app/admin/page.tsx')

test('admin privilege remains an MFA-gated server session', () => {
  assert.match(adminAuth, /COOKIE_NAME = 'otya_admin_session'/)
  assert.match(adminAuth, /mfa: true/)
  assert.match(adminSession, /\/auth\/admin\/start/)
  assert.match(adminSession, /\/auth\/admin\/verify-otp/)
  assert.match(adminSession, /\/auth\/admin\/consume/)
})

test('owner verification stays behind normal identity while the browser surface is retired', () => {
  assert.match(signIn, /'owner-otp'/)
  assert.match(signIn, /'owner-telegram'/)
  assert.match(signIn, /action: 'verify-otp'/)
  assert.match(signIn, /action: 'complete'/)
  assert.match(adminPage, /telegram_challenge/)
  assert.match(adminPage, /action: 'complete'/)
  assert.match(adminPage, /Open Otya bot/)
  assert.match(adminPage, /I've confirmed in Telegram/)
  assert.doesNotMatch(adminPage, /mode=admin|Continue with Telegram/)
  assert.match(adminLayout, /Owner control is in Next/)
  assert.doesNotMatch(adminLayout, /Unlock Admin/)
})
