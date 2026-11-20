import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('public Omy Play and Opoint product names use canonical routes', () => {
  const download = read('src/app/download/omy-play/page.tsx')
  const media = read('src/app/omy-play/page.tsx')
  const shop = read('src/app/opoint/page.tsx')
  const nav = read('src/components/SiteNav.tsx')
  const footer = read('src/components/SiteFooter.tsx')
  assert.equal(existsSync(new URL('../src/app/apk/[file]/route.ts', import.meta.url)), false)
  assert.match(download, /title: 'Download Omy Play for Android'/)
  assert.match(download, /alternates: \{ canonical: 'https:\/\/otya\.site\/download\/omy-play' \}/)
  assert.match(media, /title: 'Omy Play — Offline Music & Video for Android'/)
  assert.match(media, /alternates: \{ canonical: 'https:\/\/otya\.site\/omy-play' \}/)
  assert.match(shop, /name: 'Opoint'/)
  assert.match(shop, /alternates: \{ canonical: .+\/opoint/)
  assert.ok(nav.includes("['Omy Play', '/omy-play']"))
  assert.ok(nav.includes("['Opoint', '/opoint']"))
  assert.ok(footer.includes("['Omy Play', '/omy-play']"))
  assert.ok(footer.includes("['Opoint shop', '/opoint']"))
})

test('Space navigation presents O as the owner assistant, not Next', () => {
  const spaceShell = read('src/components/OtyaSpaceChrome.tsx')
  assert.doesNotMatch(spaceShell, /label: 'Next'|Otya AI/)
  assert.match(spaceShell, /Otya Space home/)
})
