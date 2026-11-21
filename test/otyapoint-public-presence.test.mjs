import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Otya shop is discoverable from customer navigation, home, products and footer', () => {
  const nav=read('src/components/SiteNav.tsx')
  const home=read('src/components/HomeStart.tsx')
  const products=read('src/app/apps/page.tsx')
  const footer=read('src/components/SiteFooter.tsx')
  const sitemap=read('src/app/sitemap.ts')
  for(const source of [nav,home,products,footer,sitemap]) assert.doesNotMatch(source,/Opoint/)
  assert.match(nav,/\['Otya shop', '\/shop'\]/)
  assert.match(home,/Otya · Physical shop/)
  assert.match(home,/href="\/shop"/)
  assert.match(products,/Otya shop|Otya physical shop|the Otya shop/)
  assert.match(products,/href="\/shop"/)
  assert.match(footer,/\['Otya shop', '\/shop'\]/)
  assert.match(sitemap,/\$\{BASE\}\/shop/)
})

test('public Otya shop page describes the real physical store without exposing the private Opoint app', () => {
  const page=read('src/app/shop/page.tsx')
  for(const value of ['Otya','Old Market area','Mbirizi','Lwengo District','Phones & accessories','Electronics','Mobile-money agency','support@otya.site']) assert.ok(page.includes(value),value)
  assert.match(page,/google\.com\/maps\/search/)
  assert.match(page,/There is no online cart, checkout or online payment/)
  assert.match(page,/Purchases and mobile-money agency services are handled in person at Otya/)
  assert.doesNotMatch(page,/Opoint|tel:|wa\.me|openingHours|telephone:/i)
})

test('old public /opoint URL permanently redirects to the Otya shop', () => {
  const legacy=read('src/app/opoint/page.tsx')
  assert.ok(legacy.includes("permanentRedirect('/shop')"))
})
