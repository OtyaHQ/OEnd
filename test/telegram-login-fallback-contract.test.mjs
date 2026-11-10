import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const wrapper = read('auth-worker/src/production-entrypoint-miniapp.ts')
const primaryLogin = read('auth-worker/src/telegram-primary-login.ts')
const telegramLogin = read('auth-worker/src/telegram-login.ts')
const miniAuth = read('auth-worker/src/telegram-miniapp.ts')
const miniProxy = read('src/app/api/auth/telegram/[...path]/route.ts')
const signIn = read('src/app/sign-in/page.tsx')
const methods = read('src/app/account/sign-in-methods/page.tsx')
const config = read('next.config.mjs')
const router = read('src/production-router.mjs')
const wrangler = read('auth-worker/wrangler.toml')
const secretWorkflowUrl = new URL('../.github/workflows/telegram-auth-secret.yml', import.meta.url)

test('Telegram cannot create an Otya sign-in session through browser OIDC', () => {
  assert.match(wrapper, /handleTelegramPrimaryLogin/)
  const start = primaryLogin.slice(primaryLogin.indexOf('async function start'), primaryLogin.indexOf('async function callback'))
  assert.match(start, /TELEGRAM_SIGN_IN_DISABLED/)
  assert.match(start, /not a sign-in method/i)
  assert.doesNotMatch(start, /AUTH_KV\.put/)
  assert.match(primaryLogin, /sign-in\?telegram=disabled/)
  assert.match(telegramLogin, /TELEGRAM_SIGN_IN_DISABLED/)
  assert.match(telegramLogin, /requested === 'login'/)
  assert.doesNotMatch(signIn, /\/api\/auth\/telegram\/start\?mode=login/)
  assert.doesNotMatch(signIn, /Continue with Telegram/)
})

test('Telegram Mini App verifies its channel but requires an existing Otya session', () => {
  assert.match(miniAuth, /WebAppData/)
  assert.match(miniAuth, /constantTimeHexEqual/)
  assert.match(miniAuth, /authDate < now - MAX_AGE_SECONDS/)
  assert.match(miniAuth, /currentUserId\(request, env\)/)
  assert.match(miniAuth, /OTYA_ACCOUNT_REQUIRED/)
  assert.match(miniAuth, /getUserById\(env\.AUTH_DB, userId\)/)
  assert.doesNotMatch(miniAuth, /createOrGetTelegramUser|issueSession|access_token|refresh_token/)
  assert.match(miniProxy, /Mini App identity data may confirm/)
  assert.doesNotMatch(miniProxy.slice(miniProxy.indexOf("if (publicUrl.pathname.endsWith('/miniapp')"), miniProxy.indexOf("if (publicUrl.pathname.endsWith('/start')")), /cookies\.set/)
})

test('Telegram OTP delivery is separate from account sign-in and uses an independent bot identity', () => {
  assert.match(methods, /provider === 'telegram_otp_bot'/)
  assert.match(methods, /telegram-otp\/link\/start/)
  assert.match(methods, /telegram-otp\/link\/revoke/)
  assert.match(methods, /Telegram is not a sign-in method/)
  assert.match(signIn, /Telegram is used only for security-code delivery/)
  assert.match(wrangler, /binding\s*=\s*"CORE"/)
})

test('Google origin and security policy remain enforced', () => {
  assert.match(config, /https:\/\/accounts\.google\.com/)
  assert.match(router, /CANONICAL_CSP/)
  assert.match(router, /script-src[^\\n]*accounts\.google\.com/)
  assert.match(router, /connect-src[^\\n]*accounts\.google\.com/)
  assert.match(router, /headers\.set\('Content-Security-Policy', CANONICAL_CSP\)/)
  assert.doesNotMatch(router, /unsafe-eval/)
})

test('Auth reads the Telegram bot credential from Cloudflare Secrets Store', () => {
  assert.match(wrangler, /\[\[secrets_store_secrets\]\]/)
  assert.match(wrangler, /binding\s*=\s*"TELEGRAM_MINIAPP_BOT_TOKEN"/)
  assert.match(wrangler, /secret_name\s*=\s*"TELEGRAM_BOT_TOKEN"/)
  assert.equal(existsSync(secretWorkflowUrl), false)
})
