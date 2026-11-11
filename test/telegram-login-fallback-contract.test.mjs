import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const wrapper = read('auth-worker/src/production-entrypoint-miniapp.ts')
const primaryLogin = read('auth-worker/src/telegram-primary-login.ts')
const telegramLogin = read('auth-worker/src/telegram-login.ts')
const miniAuth = read('auth-worker/src/telegram-miniapp.ts')
const miniProxy = read('src/app/api/auth/telegram/[...path]/route.ts')
const secureOtp = read('auth-worker/src/secure-otp.ts')
const signIn = read('src/app/sign-in/page.tsx')
const methods = read('src/app/account/sign-in-methods/page.tsx')
const wrangler = read('auth-worker/wrangler.toml')
const secretWorkflowUrl = new URL('../.github/workflows/telegram-auth-secret.yml', import.meta.url)

test('Telegram cannot create or resume a normal Otya sign-in session', () => {
  assert.match(wrapper, /handleTelegramPrimaryLogin/)
  const start = primaryLogin.slice(primaryLogin.indexOf('async function start'), primaryLogin.indexOf('async function callback'))
  assert.match(start, /TELEGRAM_LOGIN_RETIRED/)
  assert.match(start, /status: 410/)
  assert.doesNotMatch(start, /AUTH_KV\.put/)
  assert.match(primaryLogin, /sign-in\?telegram=disabled/)
  assert.match(telegramLogin, /TELEGRAM_LOGIN_RETIRED/)
  assert.match(telegramLogin, /status: 410/)
  assert.doesNotMatch(signIn, /\/api\/auth\/telegram\/start\?mode=login/)
  assert.doesNotMatch(signIn, /Continue with Telegram/)
})

test('Telegram Mini App is only a channel assertion for an existing Otya session', () => {
  assert.match(miniAuth, /WebAppData/)
  assert.match(miniAuth, /constantTimeHexEqual/)
  assert.match(miniAuth, /authDate < now - MAX_AGE_SECONDS/)
  assert.match(miniAuth, /currentUserId\(request, env\)/)
  assert.match(miniAuth, /OTYA_ACCOUNT_REQUIRED/)
  assert.doesNotMatch(miniAuth, /createOrGetTelegramUser|issueSession|access_token|refresh_token/)
  assert.match(miniProxy, /ACCESS_COOKIE = '__Secure-otya_access'/)
  assert.match(miniProxy, /authUrl\.pathname = '\/auth\/telegram\/miniapp'/)
  assert.match(miniProxy, /if \(!accessToken\)/)
  assert.doesNotMatch(miniProxy, /cookies\.set/)
})

test('Telegram OTP delivery is separate from sign-in and uses its dedicated bot identity', () => {
  assert.match(methods, /provider === 'telegram_otp_bot'/)
  assert.match(methods, /telegram-otp\/link\/start/)
  assert.match(methods, /telegram-otp\/link\/revoke/)
  assert.match(methods, /Telegram is not a sign-in method/)
  assert.match(signIn, /Telegram is used only for security-code delivery/)
  assert.match(secureOtp, /sendTelegramOtpToUser/)
  assert.match(secureOtp, /CORE\.fetch\(new Request\('https:\/\/otya-core\/internal\/telegram\/otp'/)
  assert.match(secureOtp, /provider = 'telegram_otp_bot'/)
  assert.match(wrangler, /binding\s*=\s*"CORE"/)
})

test('email and Google remain the approved normal sign-in methods', () => {
  assert.doesNotMatch(wrangler, /TELEGRAM_LOGIN_REDIRECT_URI|TELEGRAM_LOGIN_CLIENT_(?:ID|SECRET)/)
})

test('Auth reads the Telegram bot credential from Cloudflare Secrets Store', () => {
  assert.match(wrangler, /\[\[secrets_store_secrets\]\]/)
  assert.match(wrangler, /binding\s*=\s*"TELEGRAM_MINIAPP_BOT_TOKEN"/)
  assert.match(wrangler, /secret_name\s*=\s*"TELEGRAM_BOT_TOKEN"/)
  assert.equal(existsSync(secretWorkflowUrl), false)
})
