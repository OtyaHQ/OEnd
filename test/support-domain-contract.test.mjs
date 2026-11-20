import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('public support contact uses the Otya.site identity', async () => {
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

  assert.match(constants, /supportEmail:\s*'support@otya\.site'/)
  assert.match(help, /support@otya\.site/)
  assert.match(privacy, /support@otya\.site/)
  assert.match(terms, /support@otya\.site/)
  assert.match(deletion, /support@otya\.site/)
  assert.match(shop, /support@otya\.site/)
  assert.match(layout, /email:\s*'support@otya\.site'/)
  assert.match(security, /^Contact: mailto:support@otya\.site$/m)
  assert.match(security, /^Canonical: https:\/\/otya\.site\/.well-known\/security\.txt$/m)
})

test('support inbox accepts only the canonical company support address', async () => {
  const [support, consoleTools, scheduled, connections] = await Promise.all([
    read('../ai-worker/src/support-email.mjs'),
    read('../ai-worker/src/console-tools.mjs'),
    read('../ai-worker/src/scheduled-entry.mjs'),
    read('../src/app/admin/ai/settings/ConnectionsClient.tsx'),
  ])

  assert.match(support, /const SUPPORT_ADDRESS = 'support@otya\.site'/)
  assert.match(support, /const LEGACY_SUPPORT_ADDRESS = 'support@petersmartlink\.com'/)
  assert.equal((support.match(/to:\{\$\{SUPPORT_ADDRESS\} \$\{LEGACY_SUPPORT_ADDRESS\}\} in:inbox/g) || []).length, 2)
  assert.match(support, /\[SUPPORT_ADDRESS,LEGACY_SUPPORT_ADDRESS\]\.includes\(recipient\)/)
  assert.match(consoleTools, /to:\{support@otya\.site support@petersmartlink\.com\} in:inbox/)
  assert.match(scheduled, /to:\{support@otya\.site support@petersmartlink\.com\} in:inbox/)
  assert.match(connections, /support@otya\.site and the legacy support alias/)
})

test('authentication replies use the current support address without moving legacy CORS yet', async () => {
  const [auth, resend, invite, workflow] = await Promise.all([
    read('../auth-worker/src/entrypoint.ts'),
    read('../auth-worker/src/resend.ts'),
    read('../auth-worker/src/production-entrypoint.ts'),
    read('../.github/workflows/deploy.yml'),
  ])

  assert.match(auth, /const OTYA_SUPPORT_EMAIL = 'support@otya\.site'/)
  assert.match(auth, /const PRIMARY_ORIGIN = 'https:\/\/otya\.site'/)
  assert.match(legacyAuth, /'https:\/\/petersmartlink\.com'/)
  assert.match(resend, /const OTYA_SUPPORT_EMAIL = 'support@otya\.site'/)
  assert.match(invite, /replyTo: 'support@otya\.site'/)
  assert.match(workflow, /https:\/\/otya\.site\/.well-known\/security\.txt/)
  assert.match(workflow, /Contact: mailto:support@otya\.site/)
})
