import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Opoint is discoverable from customer navigation, home, products and footer', () => {
  const nav = read('src/components/SiteNav.tsx')
  const home = read('src/components/HomeStart.tsx')
  const products = read('src/app/apps/page.tsx')
  const footer = read('src/components/SiteFooter.tsx')
  const sitemap = read('src/app/sitemap.ts')

  for (const source of [nav, home, products, footer]) assert.match(source, /Opoint/)
  for (const source of [nav, home, products, footer]) {
    assert.doesNotMatch(source, /Otya shop|Otya · Physical shop|Otya physical shop/)
  }
  assert.match(nav, /\['Opoint shop', '\/shop'\]/)
  assert.match(home, /Opoint · Physical shop/)
  assert.match(home, /href="\/shop"/)
  assert.match(products, /Opoint/)
  assert.match(products, /href="\/shop"/)
  assert.match(footer, /\['Opoint shop', '\/shop'\]/)
  assert.match(sitemap, /\$\{BASE\}\/shop/)
})

test('public Opoint shop page describes the real physical store', () => {
  const page = read('src/app/shop/page.tsx')
  for (const value of ['Opoint', 'Old Market area', 'Mbirizi', 'Lwengo District', 'Phones & accessories', 'Electronics', 'Mobile-money agency', 'support@otya.site']) {
    assert.ok(page.includes(value), value)
  }
  assert.match(page, /google\.com\/maps\/search/)
  assert.match(page, /There is no online cart, checkout or online payment/)
  assert.match(page, /Purchases and mobile-money agency services are handled in person at Opoint/)
  assert.doesNotMatch(page, /OtyaPoint|tel:|wa\.me|openingHours|telephone:/i)
})

test('legacy /opoint URL permanently redirects to the Opoint shop', () => {
  const legacy = read('src/app/opoint/page.tsx')
  assert.ok(legacy.includes("permanentRedirect('/shop')"))
})
