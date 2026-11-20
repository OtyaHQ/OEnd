import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Omy Play has canonical product and download pages without the old APK endpoint', () => {
  const apkRouteExists = existsSync(new URL('../src/app/apk/[file]/route.ts', import.meta.url))
  const download = read('src/app/download/omy-play/page.tsx')
  const media = read('src/app/omy-play/page.tsx')
  const nav = read('src/components/SiteNav.tsx')
  const footer = read('src/components/SiteFooter.tsx')
  assert.equal(apkRouteExists, false)
  assert.match(download, /title: 'Download Omy Play for Android'/)
  assert.match(download, /alternates: \{ canonical: 'https:\/\/otya\.site\/download\/omy-play' \}/)
  assert.match(media, /title: 'Omy Play — Offline Music & Video for Android'/)
  assert.match(media, /alternates: \{ canonical: 'https:\/\/otya\.site\/omy-play' \}/)
  assert.match(nav, /\['Omy Play', '\/omy-play'\]/)
  assert.match(footer, /\['Omy Play', '\/omy-play'\]/)
  assert.ok(!nav.includes('otya-player') && !nav.includes('Otya Media') && !nav.includes('Otya Player'))
})

test('Opoint shop uses the permanent name and canonical route', () => {
  const shop = read('src/app/opoint/page.tsx')
  const nav = read('src/components/SiteNav.tsx')
  const footer = read('src/components/SiteFooter.tsx')
  assert.match(shop, /name: 'Opoint'/)
  assert.match(shop, /alternates: \{ canonical: .+\/opoint/)
  assert.match(nav, /\['Opoint', '\/opoint'\]/)
  assert.match(footer, /\['Opoint shop', '\/opoint'\]/)
  assert.ok(!shop.includes('OtyaPoint') && !shop.includes('/otyapoint'))
})
