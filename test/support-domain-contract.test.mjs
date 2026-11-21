import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
test('public support contact uses the canonical Otya website address', async () => {
  const paths=['../src/lib/constants.ts','../src/app/help/page.tsx','../src/app/privacy/page.tsx','../src/app/terms/page.tsx','../src/app/delete-account/page.tsx','../src/app/shop/page.tsx','../src/app/layout.tsx','../public/.well-known/security.txt']
  const sources=await Promise.all(paths.map(read))
  for(const source of sources) {
    assert.match(source,/support@otya\.site/)
    assert.doesNotMatch(source,/petersmartlink\.com/)
  }
  const legacyShop=await read('../src/app/opoint/page.tsx')
  assert.match(legacyShop,/permanentRedirect\('\/shop'\)/)
})
test('O support inbox retains inbound compatibility but sends from the canonical Otya address', async () => {
  const [support,consoleTools,scheduled,connections]=await Promise.all([
    read('../ai-worker/src/support-email.mjs'),read('../ai-worker/src/console-tools.mjs'),read('../ai-worker/src/scheduled-entry.mjs'),read('../src/app/admin/ai/settings/ConnectionsClient.tsx')
  ])
  assert.match(support,/SUPPORT_FROM = 'Otya Support <support@otya\.site>'/)
  assert.match(support,/SUPPORT_ADDRESS = 'support@otya\.site'/)
  assert.match(support,/LEGACY_SUPPORT_ADDRESS = 'support@petersmartlink\.com'/)
  assert.match(support,/LEGACY_SUPPORT_ADDRESS/)
  assert.match(support,/from:SUPPORT_FROM/)
  assert.match(support,/reply_to:SUPPORT_ADDRESS/)
  assert.ok(consoleTools.includes("support@otya.site support@petersmartlink.com"))
  assert.ok(scheduled.includes("support@otya.site support@petersmartlink.com"))
  assert.match(connections,/support@otya\.site/)
  assert.doesNotMatch(connections,/legacy support alias|petersmartlink/)
})
test('identity and invitation messages use the canonical support address', async () => {
  const sources=await Promise.all(['../auth-worker/src/entrypoint.ts','../auth-worker/src/resend.ts','../auth-worker/src/production-entrypoint.ts','../.github/workflows/deploy.yml'].map(read))
  for(const source of sources) {
    assert.match(source,/support@otya\.site/)
    assert.doesNotMatch(source,/petersmartlink\.com/)
  }
})
