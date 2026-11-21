import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Otya is the public identity of the physical shop', () => {
  const navigation = read('src/components/SiteNav.tsx')
  const home = read('src/components/HomeStart.tsx')
  const products = read('src/app/apps/page.tsx')
  const footer = read('src/components/SiteFooter.tsx')
  const sitemap = read('src/app/sitemap.ts')
  const homepage = read('src/app/page.tsx')

  assert.match(navigation, /\['Shop', '\/shop'\]/)
  assert.match(home, /href="\/shop"/)
  assert.match(products, /href="\/shop"/)
  assert.match(footer, /\['Otya shop', '\/shop'\]/)
  assert.match(sitemap, /\$\{BASE\}\/shop/)
  for (const source of [navigation, home, products, footer, sitemap, homepage]) {
    assert.doesNotMatch(source, /Opoint|OtyaPoint|\/opoint|\/otyapoint/)
  }
})

test('Otya shop page describes the real physical shop without invented contact details', () => {
  const page = read('src/app/shop/page.tsx')
  assert.match(page, /name: 'Otya'/)
  assert.match(page, /Old Market area/)
  assert.match(page, /Mbirizi/)
  assert.match(page, /Lwengo District/)
  assert.match(page, /Phones & accessories/)
  assert.match(page, /Electronics/)
  assert.match(page, /Mobile-money agency/)
  assert.match(page, /google\.com\/maps\/search/)
  assert.match(page, /support@otya\.site/)
  assert.doesNotMatch(page, /Opoint|OtyaPoint|tel:|wa\.me|openingHours|telephone:/i)
})

test('legacy private application names never become a public storefront', () => {
  const router = read('src/production-router.mjs')
  const opoint = read('src/app/opoint/page.tsx')
  const oldOpoint = read('src/app/otyapoint/page.tsx')

  assert.match(router, /\['\/opoint', '\/shop'\]/)
  assert.match(router, /\['\/otyapoint', '\/shop'\]/)
  assert.match(opoint, /redirect\('\/shop'\)/)
  assert.match(oldOpoint, /redirect\('\/shop'\)/)
})
