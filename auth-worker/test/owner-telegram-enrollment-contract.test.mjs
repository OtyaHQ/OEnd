import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const auth = readFileSync(new URL('../src/admin-mfa.ts', import.meta.url), 'utf8')
const login = readFileSync(new URL('../src/telegram-login.ts', import.meta.url), 'utf8')
const telegram = readFileSync(new URL('../../src/telegram-entrypoint.mjs', import.meta.url), 'utf8')

test('email OTP is the owner step-up factor and Telegram is optional delivery only', () => {
  assert.match(auth, /const OTP_TTL = 10 \* 60/)
  assert.match(auth, /admin_mfa_otp:/)
  assert.match(auth, /otpDigest\(user\.id, otp\)/)
  assert.match(auth, /sendLinkedTelegramOtp\(env, user\.id, otp, 'Next owner device enrollment'\)/)
  assert.match(auth, /Email OTP is the owner step-up proof/)
  assert.match(auth, /admin_mfa_complete:/)
  assert.doesNotMatch(auth, /telegram-challenge|markAdminTelegramComplete|TELEGRAM_CHALLENGE_PREFIX/)
})

test('Telegram linking cannot create an Otya session or confirm owner step-up', () => {
  assert.match(login, /if \(stored\.mode !== 'link' \|\| !stored\.userId\)/)
  assert.match(login, /TELEGRAM_LOGIN_DISABLED/)
  assert.doesNotMatch(auth, /telegram-challenge\/confirm|markAdminTelegramComplete/)
  assert.doesNotMatch(telegram, /auth\/admin\/telegram-challenge\/confirm/)
})

test('Otya Core keeps webhook verification and the Auth service binding', () => {
  assert.match(telegram, /X-Telegram-Bot-Api-Secret-Token/)
  assert.match(telegram, /env\.AUTH\.fetch/)
  assert.match(telegram, /TELEGRAM_WEBHOOK_FINGERPRINT_KEY/)
})
