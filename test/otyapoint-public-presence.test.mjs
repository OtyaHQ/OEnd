import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('OtyaPoint is discoverable from primary navigation, home, product directory and footer', () => {
  const navigation = read('src/components/SiteNav.tsx')
  const home = read('src/components/HomeStart.tsx')
  const products = read('src/app/apps/page.tsx')
  const footer = read('src/components/SiteFooter.tsx')
  const sitemap = read('src/app/sitemap.ts')

  assert.match(navigation, /\['OtyaPoint', '\/otyapoint'\]/)
  assert.match(home, /href="\/otyapoint"/)
  assert.match(products, /href="\/otyapoint"/)
  assert.match(footer, /\['OtyaPoint shop', '\/otyapoint'\]/)
  assert.match(sitemap, /\$\{BASE\}\/otyapoint/)
})

test('OtyaPoint page describes the real physical shop and avoids invented contact/location details', () => {
  const page = read('src/app/otyapoint/page.tsx')

  assert.match(page, /Old Market area/)
  assert.match(page, /Mbirizi/)
  assert.match(page, /Lwengo District/)
  assert.match(page, /Phones & accessories/)
  assert.match(page, /Electronics/)
  assert.match(page, /Mobile-money agency/)
  assert.match(page, /google\.com\/maps\/search/)
  assert.match(page, /support@petersmartlink\.com/)
  assert.doesNotMatch(page, /tel:|wa\.me|openingHours|telephone:/i)
})

test('OtyaPoint website remains an information and visit page, not an online store', () => {
  const page = read('src/app/otyapoint/page.tsx')

  assert.match(page, /There is no online cart, checkout or online payment/)
  assert.match(page, /Purchases and mobile-money agency services are handled in person/)
  assert.doesNotMatch(page, /Add to cart|Buy now|Place order|Card number/i)
})
