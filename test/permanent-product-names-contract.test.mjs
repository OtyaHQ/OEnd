import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const read = path => readFileSync(path, 'utf8')
test('public Otya surfaces use the permanent Omy Play product name and routes', () => {
  const apkRouteExists = existsSync(new URL('../src/app/apk/[file]/route.ts', import.meta.url))
  const canonicalDownload = read('src/app/download/omy-play/page.tsx')
  const mediaPage = read('src/app/omy-play/page.tsx')
  const navigation = read('src/components/SiteNav.tsx')
  const footer = read('src/components/SiteFooter.tsx')
  assert.equal(apkRouteExists, false)
  
  assert.match(canonicalDownload, /title: 'Download Omy Play for Android'/)
  assert.ok(canonicalDownload.includes("alternates: { canonical: 'https://otya.site/download/omy-play' }"))
  assert.match(mediaPage, /title: 'Omy Play — Offline Music & Video for Android'/)
  assert.ok(mediaPage.includes("alternates: { canonical: 'https://otya.site/omy-play' }"))
  assert.match(navigation, /\['Omy Play', '\/omy-play'\]/)
  assert.match(footer, /\['Omy Play', '\/omy-play'\]/)
  assert.doesNotMatch(navigation, /otya-player|otya-player/)
})
test('public Opoint shop page uses the permanent Opoint product name and route', () => {
  const shop = read('src/app/opoint/page.tsx')
  const navigation = read('src/components/SiteNav.tsx')
  const footer = read('src/components/SiteFooter.tsx')
  assert.match(shop, /name: 'Opoint'/)
  assert.ok(shop.includes("alternates: { canonical: `${SITE_URL}/opoint` }"))
  assert.match(navigation, /\['Opoint', '\/opoint'\]/)
  assert.match(footer, /\['Opoint shop', '\/opoint'\]/)
  assert.doesNotMatch(shop, /OtyaPoint|\\/otyapoint/)
})
