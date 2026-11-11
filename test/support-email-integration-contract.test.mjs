import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Next Gmail OAuth uses the verified Web client instead of the Android client', () => {
  const wrangler = read('ai-worker/wrangler.toml')
  assert.match(wrangler, /GMAIL_GOOGLE_CLIENT_ID = "82776565585-obr8k53b8n6djsggissv8qne81cm3u5u\.apps\.googleusercontent\.com"/)
  assert.doesNotMatch(wrangler, /GMAIL_GOOGLE_CLIENT_ID = "82776565585-77b1t8epvmn3mpdvstdg1rtprlju4suv\.apps\.googleusercontent\.com"/)
})

test('support inbox follows Cloudflare Email Routing into Gmail while Resend stays outbound', () => {
  const support = read('ai-worker/src/support-email.mjs')
  const consoleTools = read('ai-worker/src/console-tools.mjs')
  const scheduled = read('ai-worker/src/scheduled-entry.mjs')

  for (const source of [support, consoleTools, scheduled]) {
    assert.doesNotMatch(source, /resend\.com\/emails\/receiving/)
    assert.match(source, /listGmailMessages/)
  }
  assert.ok(support.includes('supportAddress(env)'));
  assert.match(support, /resend\(env,'\/emails'/)
  assert.doesNotMatch(consoleTools, /capabilities: \['support inbox', 'personal replies', 'transactional email'\]/)
})

test('private settings expose a real Gmail consent action and safe connection status', () => {
  const page = read('src/app/admin/ai/settings/page.tsx')
  const connections = read('src/app/admin/ai/settings/ConnectionsClient.tsx')
  const router = read('src/production-router.mjs')

  assert.match(page, /<ConnectionsClient \/>/)
  assert.match(connections, /\/api\/admin\/ai\/connectors\/status/)
  assert.match(connections, /\/api\/admin\/ai\/connectors\/gmail\/start/)
  assert.match(connections, /Connect Gmail/)
  assert.match(router, /pathname\.startsWith\('\/api\/admin\/ai\/'\)/)
})
