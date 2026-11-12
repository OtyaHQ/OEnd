import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const coreConfig = read('wrangler.toml')
const authConfig = read('auth-worker/wrangler.toml')
const secureAuth = read('auth-worker/src/production-entrypoint-secure.ts')
const baseAuth = read('auth-worker/src/entrypoint.ts')
const core = read('src/telegram-entrypoint.mjs')
const bot = read('src/lib/telegram-bot.mjs')
const receipts = read('migrations/0010_telegram_update_receipts.sql')
const mfa = read('auth-worker/src/admin-mfa.ts')

test('Telegram bot credentials are owned by Otya Core, not Otya Auth', () => {
  assert.match(coreConfig, /binding\\s*=\\s*"TELEGRAM_BOT_TOKEN"/)
  assert.match(coreConfig, /binding\\s*=\\s*"TELEGRAM_WEBHOOK_SECRET"/)
  assert.match(coreConfig, /store_id\\s*=\\s*"a1df6b906c6e4c1da6e7687330ea0f9c"/)
  assert.doesNotMatch(authConfig, /binding\\s*=\\s*["']TELEGRAM_/)
  assert.doesNotMatch(authConfig, /wrangler secret put TELEGRAM_/)
  assert.doesNotMatch(baseAuth, /handleTelegramLogin|telegram-primary-login|telegram-miniapp/)
  assert.match(secureAuth, /telegramSignInDisabled/)
})

test('Otya Core is the sole public Telegram webhook gateway with replay protection', () => {
  assert.match(core, /url\\.pathname === '\\/api\\/telegram\\/webhook'/)
  assert.match(core, /url\\.pathname\\.startsWith\\('\\/api\\/telegram\\/'\\).*404/s)
  assert.match(bot, /X-Telegram-Bot-Api-Secret-Token/)
  assert.match(bot, /constantTimeEqual/)
  assert.match(bot, /INSERT OR IGNORE INTO telegram_update_receipts/)
  assert.match(bot, /finishTelegramUpdate/)
  assert.match(receipts, /update_id INTEGER PRIMARY KEY/)
  assert.match(bot, /ctx\\?\\.waitUntil/)
  assert.match(bot, /https:\\/\\/api\\.telegram\\.org/)
})

test('Telegram is an optional message/verification transport, not an account session issuer', () => {
  assert.match(mfa, /confirmAdminTelegramChallenge/)
  assert.match(mfa, /linked\\.user_id !== userId/)
  assert.match(mfa, /markAdminTelegramComplete/)
  assert.doesNotMatch(bot, /access_token|refresh_token|signJwt|issueSession/)
  assert.doesNotMatch(mfa, /issueBrowserTokens|issueSession/)
  assert.match(secureAuth, /status: 410/)
})
