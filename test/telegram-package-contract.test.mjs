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
  assert.ok(coreConfig.includes('binding = "TELEGRAM_BOT_TOKEN"'))
  assert.ok(coreConfig.includes('binding = "TELEGRAM_WEBHOOK_SECRET"'))
  assert.ok(coreConfig.includes('store_id = "a1df6b906c6e4c1da6e7687330ea0f9c"'))
  assert.ok(!authConfig.includes('binding = "TELEGRAM_BOT_TOKEN"'))
  assert.ok(!authConfig.includes('binding = "TELEGRAM_MINIAPP_BOT_TOKEN"'))
  assert.ok(!baseAuth.includes('handleTelegramLogin'))
  assert.ok(secureAuth.includes('telegramSignInDisabled'))
})

test('Otya Core is the sole public Telegram webhook gateway with replay protection', () => {
  assert.ok(core.includes("url.pathname === '/api/telegram/webhook'"))
  assert.ok(core.includes("url.pathname.startsWith('/api/telegram/')"))
  assert.ok(bot.includes('X-Telegram-Bot-Api-Secret-Token'))
  assert.ok(bot.includes('constantTimeEqual'))
  assert.ok(bot.includes('INSERT OR IGNORE INTO telegram_update_receipts'))
  assert.ok(bot.includes('finishTelegramUpdate'))
  assert.ok(receipts.includes('update_id INTEGER PRIMARY KEY'))
  assert.ok(bot.includes('waitUntil'))
  assert.ok(bot.includes('https://api.telegram.org'))
})

test('Telegram is an optional message/verification transport, not an account session issuer', () => {
  assert.ok(mfa.includes('confirmAdminTelegramChallenge'))
  assert.ok(mfa.includes('linked.user_id !== userId'))
  assert.ok(mfa.includes('markAdminTelegramComplete'))
  assert.ok(!bot.includes('access_token'))
  assert.ok(!bot.includes('refresh_token'))
  assert.ok(!bot.includes('signJwt'))
  assert.ok(!mfa.includes('issueBrowserTokens'))
  assert.ok(!mfa.includes('issueSession'))
  assert.ok(secureAuth.includes('status: 410'))
})
