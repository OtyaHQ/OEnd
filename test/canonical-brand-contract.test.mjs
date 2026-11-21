import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const activeBrandConsumers = [
  'src/components/OtyaBrandMark.tsx',
  'src/app/omy-play/page.tsx',
  'src/app/layout.tsx',
  'auth-worker/src/resend.ts',
  'public/otya-ai.svg',
  'public/manifest.json',
  'public/otya-icon.svg',
  'public/site.webmanifest',
  'src/app/brand-overrides.css',
  'public/otya-icon-dark.svg',
  'public/otya-ai-thinking.svg',
  'public/otya-ai-thinking-light.svg',
]

test('website, admin wrappers and account email use one canonical Otya mark', () => {
  for (const path of activeBrandConsumers) {
    const source = read(path)
    assert.doesNotMatch(source, /otya-mark-current\.png/, `${path} still references the retired mark`)
    assert.match(source, /assets\.otya\.site\/brand\/otya\/v4|otya-app-icon\.webp/, `${path} must resolve to an approved Otya artwork asset`)
  }

  const sync = read('scripts/sync-brand-assets.mjs')
  assert.match(sync, /assets\.otya\.site\/brand\/otya\/v4\/otya-master-icon-512\.webp/)
  assert.match(sync, /sha256: '977722e97ce4ebe6a1857c8fce31b04ac34ae35826aa413d4f1ac759cf731445'/)
  assert.match(sync, /target: 'public\/otya-app-icon\.webp'/)
  assert.match(sync, /otya-master-lockup\.webp/)
  assert.match(sync, /f9bff0511c552a13bb90ac50428caf1c01911ffa9835f5b06b055517f681c3b2/)
  assert.match(sync, /height: 208/)
  assert.match(sync, /otya-company-footer\.webp/)
  assert.match(sync, /2579c511ba5ee518eb1a582d95c236648621e2d46218c91e9f5a483b8b450d9a/)
  assert.match(sync, /64a1fd216c4304ddd2d59361532cdc358836e328a562d0d3c1a87d22854c0d27/)
  assert.match(sync, /a4d8bb1c245d7f0b4413e2bcff9d1d2e25eecbdd7ab0ff376046343c0067667a/)
  assert.match(sync, /7dd43b6aa9f6a5a4d1560c1fa02934b20150630539dbe45d03cce790f86d1bef/)
  assert.match(sync, /73f6e19997cbf28f65380ec9d6b25a5cdd27c34c3c8ee0fde0981fe082f0089e/)
  for (const value of ['Opoint', 'Omy Play', 'Otya OS', 'OHub', 'OID', 'Shop. Pay. More.', 'Watch. Enjoy.', 'Your Smart Platform.', 'Build Together.', 'Secure Always.']) {
    assert.ok(sync.includes(value), value)
  }
  assert.doesNotMatch(sync, /url: 'https:\/\/assets\.otya\.site\/brand\/otya\/v4\/otya-product-strip\.webp'/)
  assert.match(sync, /RETIRED_GENERATED_TARGETS/)
  assert.match(sync, /public\/otya-product-strip\.webp/)
  assert.match(sync, /public\/otya-mark-current\.png/)
  assert.doesNotMatch(sync, /SOURCE[^\n]*otya_mark_current\.png/)
  assert.doesNotMatch(sync, /TARGET = 'public\/otya-mark-current\.png'/)
})

test('public web manifests describe the canonical 512px WebP identity', () => {
  for (const path of ['public/manifest.json', 'public/site.webmanifest']) {
    const manifest = read(path)
    assert.match(manifest, /"name": "Otya"/)
    assert.match(manifest, /otya-master-icon-512\.webp/)
    assert.match(manifest, /"sizes": "512x512"/)
    assert.match(manifest, /"type": "image\/webp"/)
  }
})
