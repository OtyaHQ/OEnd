import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
test('O cannot broadcast on the OEnd-owned public push queue', () => {
  const oConfig = read('ai-worker/wrangler.toml')
  const oWorker = read('ai-worker/src/index.mjs')
  const endConfig = read('wrangler.toml')
  assert.doesNotMatch(oConfig, /binding\s*=\s*"PUSH_QUEUE"/)
  assert.doesNotMatch(oConfig, /queue\s*=\s*"oend-push"/)
  assert.doesNotMatch(oWorker, /PUSH_QUEUE|send_update_notification|sendUpdateNotification/)
  assert.match(endConfig, /binding\s*=\s*"PUSH_QUEUE"[\s\S]*?queue\s*=\s*"oend-push"/)
})
test('O rejects Telegram transport routes and does not own bot credentials', () => {
  const scheduled = read('ai-worker/src/scheduled-entry.mjs')
  const oConfig = read('ai-worker/wrangler.toml')
  const oWorker = read('ai-worker/src/index.mjs')
  const deploy = read('.github/workflows/deploy.yml')
  assert.ok(scheduled.includes("url.pathname.startsWith('/api/telegram/')"))
  assert.match(scheduled, /Telegram transport is owned by OEnd/)
  assert.doesNotMatch(oConfig, /TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK_SECRET/)
  assert.doesNotMatch(oWorker, /TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK_SECRET|api\.telegram\.org/)
  assert.match(deploy, /"TELEGRAM_BOT_TOKEN":null,"TELEGRAM_WEBHOOK_SECRET":null/)
})
test('OEnd remains the sole push and Telegram transport owner', () => {
  const queue = read('src/queue-worker.mjs')
  const telegram = read('src/lib/telegram-bot.mjs')
  assert.match(queue, /batch\.queue !== 'oend-push'/)
  assert.match(queue, /PUBLIC_FCM_TOPIC = 'otya_public'/)
  assert.match(telegram, /api\.telegram\.org/)
})
