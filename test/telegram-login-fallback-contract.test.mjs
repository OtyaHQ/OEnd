import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const wrapper = read('auth-worker/src/production-entrypoint-miniapp.ts')
const miniAuth = read('auth-worker/src/telegram-miniapp.ts')
const telegramLogin = read('auth-worker/src/telegram-login.ts')
const proxy = read('src/app/api/auth/telegram/[...path]/route.ts')
const config = read('next.config.mjs')
const router = read('src/production-router.mjs')
const wrangler = read('auth-worker/wrangler.toml')
const primaryLoginFile = new URL('../auth-worker/src/telegram-primary-login.ts', import.meta.url)
const telegramAccountFile = new URL('../auth-worker/src/telegram-account.ts', import.meta.url)
const secretWorkflowUrl = new URL('../.github/workflows/telegram-auth-secret.yml', import.meta.url)

test('Telegram Mini App is authenticated account-linking only and cannot mint sessions', () => {
  assert.match(wrapper, /handleTelegramMiniApp\(request, miniEnv/)
  assert.doesNotMatch(wrapper, /handleTelegramPrimaryLogin|telegram-primary-login/)
  assert.match(miniAuth, /OTYA_ACCOUNT_REQUIRED/)
  assert.match(miniAuth, /currentUserId\(request, env\)/)
  assert.match(miniAuth, /INSERT INTO linked_identities/)
  assert.match(miniAuth, /TELEGRAM_ALREADY_LINKED/)
  assert.doesNotMatch(miniAuth, /createOrGetTelegramUser|generateRefreshToken|signJwt|issueSession|created_or_logged_in/)
  assert.equal(existsSync(primaryLoginFile), false)
  assert.equal(existsSync(telegramAccountFile), false)
})

test('Telegram OIDC and Login Widget can only link an already authenticated Otya account', () => {
  assert.match(telegramLogin, /requested === 'login' \|\| requested === 'admin'/)
  assert.match(telegramLogin, /if \(stored\.mode !== 'link' \|\| !stored\.userId\) return telegramSignInDisabled\(\)/)
  assert.match(telegramLogin, /const mode: TelegramMode = 'link'/)
  assert.match(telegramLogin, /const userId = await requireUser\(request, env\)/)
  assert.doesNotMatch(telegramLogin, /issueBrowserTokens|generateRefreshToken|signJwt|telegram_login: true/)
  assert.doesNotMatch(wrapper, /handleTelegramPrimaryLogin/)
})

test('Browser proxy never converts Telegram response tokens into Otya session cookies', () => {
  assert.match(proxy, /delete safe\.access_token/)
  assert.match(proxy, /delete safe\.refresh_token/)
  assert.match(proxy, /withoutTokens\(data\)/)
  assert.doesNotMatch(proxy, /response\.cookies\.set/)
  assert.doesNotMatch(proxy, /telegram_login === true/)
})

test('Google and Telegram browser origins remain constrained without unsafe-eval', () => {
  assert.match(config, /https:\/\/accounts\.google\.com/)
  assert.match(config, /https:\/\/telegram\.org/)
  assert.match(config, /frame-ancestors 'none'/)
  assert.match(router, /CANONICAL_CSP/)
  assert.match(router, /headers\.set\('Content-Security-Policy', CANONICAL_CSP\)/)
  assert.doesNotMatch(router, /unsafe-eval/)
})

test('auth reads Telegram bot credential from Cloudflare Secrets Store without GitHub duplication', () => {
  assert.match(wrangler, /\[\[secrets_store_secrets\]\]/)
  assert.match(wrangler, /binding\s*=\s*"TELEGRAM_MINIAPP_BOT_TOKEN"/)
  assert.match(wrangler, /secret_name\s*=\s*"TELEGRAM_BOT_TOKEN"/)
  assert.equal(existsSync(secretWorkflowUrl), false)
})
