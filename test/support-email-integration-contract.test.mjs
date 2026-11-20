import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('O uses the verified Web OAuth client for Gmail support', () => {
  const wrangler = read('ai-worker/wrangler.toml')
  assert.ok(wrangler.includes('GMAIL_GOOGLE_CLIENT_ID = "82776565585-obr8k53b8n6djsggissv8qne81cm3u5u.apps.googleusercontent.com"'))
  assert.ok(!wrangler.includes('82776565585-77b1t8epvmn3mpdvstdg1rtprlju4suv.apps.googleusercontent.com'))
})

test('O support inbox uses Cloudflare Email Routing into Gmail while Resend remains outbound', () => {
  const support = read('ai-worker/src/support-email.mjs')
  const consoleTools = read('ai-worker/src/console-tools.mjs')
  const scheduled = read('ai-worker/src/scheduled-entry.mjs')
  for (const source of [support, consoleTools, scheduled]) {
    assert.ok(!source.includes('resend.com/emails/receiving'))
    assert.ok(source.includes('listGmailMessages'))
    assert.ok(!source.includes('petersmartlink.com') && !source.includes('LEGACY_SUPPORT_ADDRESS'))
  }
  assert.ok(support.includes('to:\${SUPPORT_ADDRESS} in:inbox'))
  assert.ok(support.includes("resend(env,'/emails'"))
  assert.ok(consoleTools.includes('to:support@otya.site in:inbox'))
  assert.ok(scheduled.includes('to:support@otya.site in:inbox'))
})

test('private settings expose Gmail consent and safe connection status', () => {
  const page = read('src/app/admin/ai/settings/page.tsx')
  const connections = read('src/app/admin/ai/settings/ConnectionsClient.tsx')
  const router = read('src/production-router.mjs')
  assert.ok(page.includes('<ConnectionsClient />'))
  assert.ok(connections.includes('/api/admin/ai/connectors/status'))
  assert.ok(connections.includes('/api/admin/ai/connectors/gmail/start'))
  assert.ok(connections.includes('Connect Gmail'))
  assert.ok(router.includes("pathname.startsWith('/api/admin/ai/')"))
})
