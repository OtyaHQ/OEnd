import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Telegram sign-in endpoints are retired and cannot issue Otya sessions', () => {
  const primary = read('auth-worker/src/telegram-primary-login.ts')
  const telegram = read('auth-worker/src/telegram-login.ts')
  const signIn = read('src/app/sign-in/page.tsx')
  assert.match(primary, /TELEGRAM_LOGIN_DISABLED/)
  assert.match(primary, /status: number/)
  assert.doesNotMatch(primary, /createOrGetTelegramUser|issueSession|generateRefreshToken/)
  assert.match(telegram, /url\.searchParams\.get\('mode'\) === 'login'/)
  assert.match(telegram, /TELEGRAM_LOGIN_DISABLED/)
  assert.doesNotMatch(telegram, /const tokens = await issueBrowserTokens/)
  assert.doesNotMatch(signIn, /\/api\/auth\/telegram\/start\?mode=login/)
  assert.doesNotMatch(signIn, /Continue with Telegram/)
})

test('Telegram Mini App only links an already authenticated Otya account', () => {
  const wrapper = read('auth-worker/src/production-entrypoint-miniapp.ts')
  const mini = read('auth-worker/src/telegram-miniapp.ts')
  assert.match(wrapper, /createRefreshSafeKv/)
  assert.match(wrapper, /AUTH_KV: createRefreshSafeKv\(rawEnv\.AUTH_KV\)/)
  assert.match(wrapper, /handleTelegramMiniApp\(request, miniEnv/)
  assert.match(wrapper, /handleTelegramPrimaryLogin\(request, authEnv\)/)
  assert.match(mini, /OTYA_SESSION_REQUIRED/)
  assert.match(mini, /const userId = await currentUserId\(request, env\)/)
  assert.match(mini, /identity\.user_id !== userId/)
  assert.match(mini, /linked: true/)
  assert.doesNotMatch(mini, /createOrGetTelegramUser|issueSession|access_token|refresh_token|created_or_logged_in/)
})

test('Telegram account linking remains authenticated and uses short-lived state', () => {
  const telegram = read('auth-worker/src/telegram-login.ts')
  const start = telegram.slice(telegram.indexOf('if (isStart) {'), telegram.indexOf('if (isWidgetCallback) {'))
  assert.match(start, /mode: TelegramMode/)
  assert.match(start, /requireUser\(request, env\)/)
  assert.match(start, /AUTH_KV\.put/)
  assert.match(start, /STATE_TTL/)
  assert.match(start, /TELEGRAM_LOGIN_DISABLED/)
})

test('Telegram linking cannot set browser sign-in cookies', () => {
  const proxy = read('src/app/api/auth/telegram/[...path]/route.ts')
  assert.match(proxy, /AUTH_PREFIX\s*=\s*'\/auth\/telegram\/'/)
  assert.match(proxy, /__Secure-otya_access/)
  assert.doesNotMatch(proxy, /__Secure-otya_refresh/)
  assert.match(proxy, /delete safe\.access_token/)
  assert.match(proxy, /delete safe\.refresh_token/)
  assert.match(proxy, /request\.cookies\.get\(ACCESS_COOKIE\)/)
  assert.doesNotMatch(proxy, /cookies\.set\(ACCESS_COOKIE/)
  assert.doesNotMatch(proxy, /cookies\.set\(REFRESH_COOKIE/)
})

test('Telegram linking keeps the bot credential in Cloudflare Secrets Store', () => {
  const wrapper = read('auth-worker/src/production-entrypoint-miniapp.ts')
  const mini = read('auth-worker/src/telegram-miniapp.ts')
  const wrangler = read('auth-worker/wrangler.toml')
  const secretWorkflowUrl = new URL('../.github/workflows/telegram-auth-secret.yml', import.meta.url)
  assert.match(wrapper, /TELEGRAM_MINIAPP_BOT_TOKEN/)
  assert.match(mini, /TELEGRAM_BOT_TOKEN\?\.get/)
  assert.match(mini, /WebAppData/)
  assert.match(wrangler, /binding\s*=\s*"TELEGRAM_MINIAPP_BOT_TOKEN"/)
  assert.match(wrangler, /secret_name\s*=\s*"TELEGRAM_BOT_TOKEN"/)
  assert.equal(existsSync(secretWorkflowUrl), false)
})
