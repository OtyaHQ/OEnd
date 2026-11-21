import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
test('public support contact uses the canonical Otya website address', async () => {
  const paths=['../src/lib/constants.ts','../src/app/help/page.tsx','../src/app/privacy/page.tsx','../src/app/terms/page.tsx','../src/app/delete-account/page.tsx','../src/app/opoint/page.tsx','../src/app/layout.tsx','../public/.well-known/security.txt']
  const sources=await Promise.all(paths.map(read))
  for(const source of sources) {
    assert.match(source,/support@otya\.site/)
    assert.doesNotMatch(source,/petersmartlink\.com/)
  }
})
test('O support inbox retains inbound compatibility but sends from the canonical Otya address', async () => {
  const [support,consoleTools,scheduled,connections]=await Promise.all([
    read('../ai-worker/src/support-email.mjs'),read('../ai-worker/src/console-tools.mjs'),read('../ai-worker/src/scheduled-entry.mjs'),read('../src/app/admin/ai/settings/ConnectionsClient.tsx')
  ])
  assert.match(support,/SUPPORT_FROM = 'Otya Support <support@otya\.site>'/)
  assert.match(support,/SUPPORT_ADDRESS = 'support@otya\.site'/)
  assert.match(support,/LEGACY_SUPPORT_ADDRESS = 'support@petersmartlink\.com'/)
  assert.ok(support.includes("`to:{\${SUPPORT_ADDRESS} \${LEGACY_SUPPORT_ADDRESS}} in:inbox`"))
  assert.match(support,/from:SUPPORT_FROM/)
  assert.match(support,/reply_to:SUPPORT_ADDRESS/)
  assert.match(consoleTools,/to:support@otya\.site in:inbox/)
  assert.match(scheduled,/to:support@otya\.site in:inbox/)
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
