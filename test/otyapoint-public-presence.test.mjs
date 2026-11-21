import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
test('Opoint is discoverable from primary navigation, home, product directory and footer', () => {
  const nav=read('src/components/SiteNav.tsx'), home=read('src/components/HomeStart.tsx'), products=read('src/app/apps/page.tsx'), footer=read('src/components/SiteFooter.tsx'), sitemap=read('src/app/sitemap.ts')
  assert.match(nav,/\['Opoint', '\/opoint'\]/)
  assert.match(home,/href="\/opoint"/)
  assert.match(products,/href="\/opoint"/)
  assert.match(footer,/\['Opoint', '\/opoint'\]/)
  assert.match(sitemap,/\$\{BASE\}\/opoint/)
})
test('Opoint page describes the real physical shop and avoids invented contact/location details', () => {
  const page=read('src/app/opoint/page.tsx')
  for(const value of ['Old Market area','Mbirizi','Lwengo District','Phones & accessories','Electronics','Mobile-money agency','support@otya.site']) assert.ok(page.includes(value),value)
  assert.match(page,/google\.com\/maps\/search/)
  assert.doesNotMatch(page,/tel:|wa\.me|openingHours|telephone:/i)
})
test('Opoint website remains an information and visit page, not an online store', () => {
  const page=read('src/app/opoint/page.tsx')
  assert.match(page,/There is no online cart, checkout or online payment/)
  assert.match(page,/Purchases and mobile-money agency services are handled in person/)
  assert.doesNotMatch(page,/Add to cart|Buy now|Place order|Card number/i)
})
