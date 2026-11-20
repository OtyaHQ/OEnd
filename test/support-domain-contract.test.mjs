import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('public support contact uses the canonical Otya website address', async () => {
  const [constants, help, privacy, terms, deletion, shop, layout, security] = await Promise.all([
    read('../src/lib/constants.ts'),
    read('../src/app/help/page.tsx'),
    read('../src/app/privacy/page.tsx'),
    read('../src/app/terms/page.tsx'),
    read('../src/app/delete-account/page.tsx'),
    read('../src/app/opoint/page.tsx'),
    read('../src/app/layout.tsx'),
    read('../public/.well-known/security.txt'),
  ])
  for (const source of [constants, help, privacy, terms, deletion, shop, layout, security]) {
    assert.match(source, /support@otya\.site/)
    assert.doesNotMatch(source, /petersmartlink\.com/)
  }
})

test('O support inbox reads only the canonical support address', async () => {
  const [support, consoleTools, scheduled, connections] = await Promise.all([
    read('../ai-worker/src/support-email.mjs'),
    read('../ai-worker/src/console-tools.mjs'),
    read('../ai-worker/src/scheduled-entry.mjs'),
    read('../src/app/admin/ai/settings/ConnectionsClient.tsx'),
  ])
  assert.match(support, /const SUPPORT_ADDRESS = 'support@otya\.site'/)
  assert.doesNotMatch(support, /LEGACY_SUPPORT_ADDRESS|petersmartlink/)
  assert.match(support, /to:\$\{SUPPORT_ADDRESS\} in:inbox/)
  assert.match(consoleTools, /to:support@otya\.site in:inbox/)
  assert.match(scheduled, /to:support@otya\.site in:inbox/)
  assert.match(connections, /support@otya\.site/)
  assert.doesNotMatch(connections, /legacy support alias|petersmartlink/)
})

test('identity and invitation messages use the canonical support and Opoint addresses', async () => {
  const [auth, resend, invite, workflow] = await Promise.all([
    read('../auth-worker/src/entrypoint.ts'),
    read('../auth-worker/src/resend.ts'),
    read('../auth-worker/src/production-entrypoint.ts'),
    read('../.github/workflows/deploy.yml'),
  ])
  for (const source of [auth, resend, invite, workflow]) {
    assert.match(source, /support@otya\.site/)
    assert.doesNotMatch(source, /petersmartlink\.com/)
  }
})
