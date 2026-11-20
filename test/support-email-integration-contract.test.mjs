import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('O uses the verified Web OAuth client for Gmail support', () => {
  const wrangler = read('ai-worker/wrangler.toml')
  assert.match(wrangler, /GMAIL_GOOGLE_CLIENT_ID = "82776565585-obr8k53b8n6djsggissv8qne81cm3u5u\.apps\.googleusercontent\.com"/)
  assert.doesNotMatch(wrangler, /GMAIL_GOOGLE_CLIENT_ID = "82776565585-77b1t8epvmn3mpdvstdg1rtprlju4suv\.apps\.googleusercontent\.com"/)
})

test('O support inbox uses Cloudflare Email Routing into Gmail while Resend remains outbound', () => {
  const support = read('ai-worker/src/support-email.mjs')
  const consoleTools = read('ai-worker/src/console-tools.mjs')
  const scheduled = read('ai-worker/src/scheduled-entry.mjs')
  for (const source of [support, consoleTools, scheduled]) {
    assert.doesNotMatch(source, /resend\.com\/emails\/receiving/)
    assert.match(source, /listGmailMessages/)
    assert.doesNotMatch(source, /petersmartlink\.com|LEGACY_SUPPORT_ADDRESS/)
  }
  assert.match(support, /to:\$\{SUPPORT_ADDRESS\} in:inbox/)
  assert.match(support, /resend\(env,'\/emails'/)
  assert.match(consoleTools, /to:support@otya\.site in:inbox/)
  assert.match(scheduled, /to:support@otya\.site in:inbox/)
})

test('private settings expose a real Gmail consent action and safe connection status', () => {
  const page = read('src/app/admin/ai/settings/page.tsx')
  const connections = read('src/app/admin/ai/settings/ConnectionsClient.tsx')
  const router = read('src/production-router.mjs')
  assert.match(page, /<ConnectionsClient \\/>/)
  assert.match(connections, /\/api\/admin\/ai\/connectors\/status/)
  assert.match(connections, /\/api\/admin\/ai\/connectors\/gmail\/start/)
  assert.match(connections, /Connect Gmail/)
  assert.match(router, /pathname\.startsWith\('\\/api\\/admin\\/ai\\/'\)/)
})
