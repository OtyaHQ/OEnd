import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const coreConfig = read('wrangler.toml')
const authConfig = read('auth-worker/wrangler.toml')
const core = read('src/telegram-entrypoint.mjs')
const bot = read('src/lib/telegram-bot.mjs')
const receiptMigration = read('migrations/0010_telegram_update_receipts.sql')
const proxy = read('src/app/api/auth/telegram/[...path]/route.ts')
const linkPage = read('src/app/telegram-login/page.tsx')
const publicPage = read('src/app/telegram/page.tsx')
const router = read('src/production-router.mjs')

test('Telegram bot credentials stay in the centralized Cloudflare Secrets Store', () => {
  assert.match(coreConfig, /\[\[secrets_store_secrets\]\]/)
  assert.match(coreConfig, /binding\s*=\s*"TELEGRAM_BOT_TOKEN"/)
  assert.match(coreConfig, /binding\s*=\s*"TELEGRAM_WEBHOOK_SECRET"/)
  assert.match(authConfig, /binding\s*=\s*"TELEGRAM_BOT_TOKEN"/)
  assert.match(authConfig, /secret_name\s*=\s*"TELEGRAM_BOT_TOKEN"/)
  assert.doesNotMatch(coreConfig, /TELEGRAM_BOT_TOKEN\s*=\s*"[^"\n]+"/)
  assert.doesNotMatch(authConfig, /TELEGRAM_BOT_TOKEN\s*=\s*"[^"\n]+"/)
})

test('otya-core is the only public Telegram webhook gateway with idempotent receipts', () => {
  assert.match(core, /url\.pathname === '\/api\/telegram\/webhook'/)
  assert.match(core, /url\.pathname\.startsWith\('\/api\/telegram\/'\).*404/s)
  assert.match(bot, /X-Telegram-Bot-Api-Secret-Token/)
  assert.match(bot, /constantTimeEqual/)
  assert.match(bot, /INSERT OR IGNORE INTO telegram_update_receipts/)
  assert.match(bot, /finishTelegramUpdate/)
  assert.match(receiptMigration, /update_id INTEGER PRIMARY KEY/)
  assert.doesNotMatch(bot, /telegram:update:/)
  assert.match(bot, /ctx\?\.waitUntil/)
  assert.match(bot, /https:\/\/api\.telegram\.org/)
})

test('Telegram bot deep links use configurable Otya surface and API origins', () => {
  assert.match(bot, /OTYA_PUBLIC_URL/)
  assert.match(bot, /OTYA_SPACE_URL/)
  assert.match(bot, /OTYA_API_URL/)
  assert.match(bot, /https:\/\/space\.otya\.site/)
  assert.match(bot, /https:\/\/api\.otya\.site/)
  assert.match(bot, /text: 'Open Otya'/)
  assert.doesNotMatch(bot, /petersmartlink\.com/)
})

test('the Telegram account-link flow and public surface are not login routes', () => {
  assert.match(linkPage, /Connect Telegram/)
  assert.match(linkPage, /does not sign you in/)
  assert.match(linkPage, /PUBLIC_URLS\\.allowedOrigins/)
  assert.doesNotMatch(linkPage, /petersmartlink\.com|Continue with Telegram/)
  assert.match(proxy, /withoutSessionMaterial/)
  assert.doesNotMatch(proxy, /response\.cookies\.set|cookies\.set\(/)
  assert.match(publicPage, /Telegram is not a sign-in method/)
  assert.doesNotMatch(publicPage, /initData|miniapp|access_token|refresh_token/)
  assert.match(router, /pathname === '\/telegram'/)
  assert.match(router, /X-Forwarded-Host/)
})

test('Otya Telegram public pages remain brand-host routed without a fixed legacy domain', () => {
  assert.match(router, /function configuredHosts/)
  assert.match(router, /function isSurfaceHost/)
  assert.match(router, /isSurfaceHost\(host, 'space', env\)/)
  assert.doesNotMatch(router, /petersmartlink\.com/)
})
