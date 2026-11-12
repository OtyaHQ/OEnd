import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const secure = read('auth-worker/src/production-entrypoint-secure.ts')
const base = read('auth-worker/src/entrypoint.ts')
const proxy = read('src/app/api/auth/telegram/[...path]/route.ts')
const mfa = read('auth-worker/src/admin-mfa.ts')
const core = read('src/telegram-entrypoint.mjs')

test('Auth rejects legacy Telegram sign-in and Mini App session-creation routes', () => {
  assert.match(secure, /telegramSignInDisabled/)
  assert.match(secure, /pathname\.startsWith\("\/auth\/telegram"\)/)
  assert.match(secure, /pathname\.includes\("\/telegram\/miniapp"\)/)
  assert.match(secure, /status: 410/)
})

test('the underlying Auth entrypoint has no Telegram login dispatch or session issuer', () => {
  assert.doesNotMatch(base, /handleTelegramLogin|TelegramLoginEnv|telegram-primary-login|telegram-miniapp/)
  assert.doesNotMatch(base, /url\.pathname\.startsWith\('\/auth\/telegram\/'\)/)
})

test('the public legacy Telegram auth proxy is a no-cookie 410 tombstone', () => {
  assert.match(proxy, /telegram_sign_in_disabled/)
  assert.match(proxy, /status:\s*410/)
  assert.doesNotMatch(proxy, /cookies\.set|access_token|refresh_token|\.AUTH as AuthService/)
})

test('Telegram admin confirmation links only an unclaimed identity through the private bot challenge', () => {
  assert.match(mfa, /confirmAdminTelegramChallenge/)
  assert.match(mfa, /linked\.user_id !== userId/)
  assert.match(mfa, /INSERT INTO linked_identities/)
  assert.match(mfa, /currentForUser/)
  assert.match(mfa, /markAdminTelegramComplete/)
  assert.match(core, /auth\/admin\/telegram-challenge\/confirm/)
  assert.doesNotMatch(mfa, /issueBrowserTokens|issueSession/)
})
