import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path, 'utf8')

test('Omy Play downloads use the product-owned production API', () => {
  const download = read('src/app/download/omy-play/DownloadButtons.tsx')
  const page = read('src/app/download/omy-play/page.tsx')
  assert.match(page, /title: 'Download Omy Play for Android'/)
  assert.match(page, /canonical: 'https:\/\/otya\.site\/download\/omy-play'/)
  assert.match(download, /https:\/\/api\.otya\.site\/omy-play\/latest/)
  assert.match(download, /https:\/\/api\.otya\.site\/omy-play\/apk\//)
  assert.match(download, /latest\.available === true/)
  assert.match(download, /No public Android release is available yet/)
  assert.doesNotMatch(download, /fetch\('\/latest'/)
  assert.doesNotMatch(download, /\/apk\/\$\{targetAbi\}/)
})

test('Opoint shop and Omy Play product links use canonical public routes', () => {
  const shop = read('src/app/opoint/page.tsx')
  const media = read('src/app/omy-play/page.tsx')
  const navigation = read('src/components/SiteNav.tsx')
  const footer = read('src/components/SiteFooter.tsx')
  const apps = read('src/app/apps/page.tsx')
  assert.match(shop, /name: 'Opoint'/)
  assert.match(shop, /canonical: 'https:\/\/otya\.site\/opoint'/)
  assert.match(media, /canonical: 'https:\/\/otya\.site\/omy-play'/)
  assert.match(navigation, /\['Opoint', '\/opoint'\]/)
  assert.match(navigation, /\['Omy Play', '\/omy-play'\]/)
  assert.match(footer, /\['Opoint shop', '\/opoint'\]/)
  assert.match(footer, /\['Omy Play', '\/omy-play'\]/)
  assert.match(apps, />O<\/h2>/)
  assert.doesNotMatch(shop, /OtyaPoint|\/otyapoint/)
  assert.doesNotMatch(media, /Otya Media|\/otya-player/)
})
