import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const wrapper = read('auth-worker/src/production-entrypoint-miniapp.ts')
const telegramLink = read('auth-worker/src/telegram-login.ts')
const telegramOtp = read('auth-worker/src/telegram-otp.ts')
const adminMfa = read('auth-worker/src/admin-mfa.ts')
const secureOtp = read('auth-worker/src/secure-otp.ts')
const proxy = read('src/app/api/auth/telegram/[...path]/route.ts')
const signIn = read('src/app/sign-in/page.tsx')
const linkPage = read('src/app/telegram-login/page.tsx')
const publicTelegramPage = read('src/app/telegram/page.tsx')
const authConfig = read('auth-worker/wrangler.toml')
const router = read('src/production-router.mjs')

test('Telegram Mini App and browser identity login cannot create Otya sessions', () => {
  assert.match(wrapper, /url\.pathname === '\/auth\/telegram\/miniapp'/)
  assert.match(wrapper, /return disabledTelegramAuth\(\)/)
  assert.match(wrapper, /TELEGRAM_LOGIN_DISABLED/)
  assert.doesNotMatch(wrapper, /handleTelegramPrimaryLogin|handleTelegramMiniApp|createOrGetTelegramUser/)
  assert.match(telegramLink, /requested && requested !== 'link'/)
  assert.match(telegramLink, /TELEGRAM_LOGIN_DISABLED/)
  assert.match(telegramLink, /stored\.mode !== 'link' \|\| !stored\.userId/)
  assert.doesNotMatch(telegramLink, /issueBrowserTokens|generateRefreshToken|signJwt/)
})

test('Telegram account linking requires an existing Otya session', () => {
  assert.match(telegramLink, /const userId = await requireUser\(request, env\)/)
  assert.match(telegramLink, /if \(!userId\) return json\(\{ error: 'Sign in to your Otya Account first\.'/)
  assert.match(telegramLink, /INSERT INTO linked_identities/)
  assert.match(telegramLink, /provider_subject/)
  assert.match(linkPage, /Connect Telegram/)
  assert.match(linkPage, /does not sign you in/)
  assert.ok(linkPage.includes('PUBLIC_URLS.allowedOrigins'));
  assert.doesNotMatch(linkPage, /Continue with Telegram|Sign in with Telegram|petersmartlink\.com/)
  assert.doesNotMatch(signIn, /Telegram Sign-In|Sign in with Telegram|Continue with Telegram/)
})

test('Telegram is an optional OTP delivery channel, not an authentication factor', () => {
  assert.match(telegramOtp, /SELECT provider_subject FROM linked_identities/)
  assert.match(telegramOtp, /sendMessage/)
  assert.match(telegramOtp, /This message does not sign you in/)
  assert.match(telegramOtp, /env\.TELEGRAM_BOT_TOKEN/)
  assert.match(adminMfa, /sendLinkedTelegramOtp/)
  assert.match(secureOtp, /sendLinkedTelegramOtp/)
  assert.match(secureOtp, /Telegram messages are a delivery channel only/)
  assert.match(authConfig, /binding\s*=\s*"TELEGRAM_BOT_TOKEN"/)
  assert.match(authConfig, /secret_name\s*=\s*"TELEGRAM_BOT_TOKEN"/)
})

test('Telegram web proxy never issues or sets an Otya session', () => {
  assert.match(proxy, /withoutSessionMaterial/)
  assert.match(proxy, /delete safe\.access_token/)
  assert.match(proxy, /delete safe\.refresh_token/)
  assert.match(proxy, /X-OTYA-Public-Origin/)
  assert.match(proxy, /request\.cookies\.get\('__Secure-otya_access'\)/)
  assert.doesNotMatch(proxy, /response\.cookies\.set|cookies\.set\(/)
  assert.doesNotMatch(proxy, /COOKIE_DOMAIN|SPACE_URL\s*=|ADMIN_RETURN_COOKIE/)
})

test('Telegram public surface is informational and cannot invoke Mini App authentication', () => {
  assert.match(publicTelegramPage, /Official Otya on Telegram/)
  assert.match(publicTelegramPage, /Telegram is not a sign-in method/)
  assert.match(publicTelegramPage, /PUBLIC_URLS/)
  assert.doesNotMatch(publicTelegramPage, /initData|miniapp|access_token|refresh_token/)
  assert.match(router, /pathname === '\/telegram'/)
  assert.match(router, /isSpaceSurfacePath/)
  assert.doesNotMatch(router, /petersmartlink\.com/)
})
