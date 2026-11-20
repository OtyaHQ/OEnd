import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('the public Otya site names the public product family consistently', () => {
  const nav = read('src/components/SiteNav.tsx')
  const footer = read('src/components/SiteFooter.tsx')
  const home = read('src/app/page.tsx')
  const apps = read('src/app/apps/page.tsx')
  const constants = read('src/lib/constants.ts')

  for (const [source, expected] of [
    [nav, "['Opoint', '/opoint']"],
    [nav, "['Omy Play', '/omy-play']"],
    [footer, "['Omy Play', '/omy-play']"],
    [footer, "['Opoint shop', '/opoint']"],
    [home, 'Omy Play'],
    [home, 'Opoint'],
    [apps, 'Omy Play'],
    [apps, 'Opoint'],
    [apps, 'Otya Help'],
    [constants, "player: 'Omy Play'"],
    [constants, "ai: 'O'"],
    [constants, "backend: 'OEnd'"],
  ]) assert.ok(source.includes(expected), 'missing canonical brand text: ' + expected)

  assert.doesNotMatch(nav, /\['OtyaPoint'|\['Otya', '\/otya-player'/)
  assert.doesNotMatch(footer, /Otya Media|OtyaPoint|\/otya-player|\/otyapoint/)
  assert.doesNotMatch(apps, /<h2[^>]*>Next<\/h2>|Otya Next/)
})

test('canonical product pages and legacy redirects preserve existing public links', () => {
  const router = read('src/production-router.mjs')
  const sitemap = read('src/app/sitemap.ts')
  const player = read('src/app/omy-play/page.tsx')
  const download = read('src/app/download/omy-play/page.tsx')
  const opoint = read('src/app/opoint/page.tsx')

  assert.match(router, /\['\/otya-player', '\/omy-play'\]/)
  assert.match(router, /\['\/download\/otya-player', '\/download\/omy-play'\]/)
  assert.match(router, /\['\/otyapoint', '\/opoint'\]/)
  assert.match(router, /status: 308/)
  assert.match(player, /canonical: 'https:\/\/otya\.site\/omy-play'/)
  assert.match(download, /canonical: 'https:\/\/otya\.site\/download\/omy-play'/)
  assert.match(opoint, /canonical: 'https:\/\/otya\.site\/opoint'/)
  assert.match(sitemap, /\$\{BASE\}\/omy-play/)
  assert.match(sitemap, /\$\{BASE\}\/opoint/)
  assert.doesNotMatch(sitemap, /\$\{BASE\}\/ask|otya-player|otyapoint/)
})

test('site structured data identifies the actual Omy Play Android package', () => {
  const layout = read('src/app/layout.tsx')
  assert.match(layout, /name: 'Omy Play'/)
  assert.match(layout, /identifier: 'com\.otya\.omyplay'/)
  assert.match(layout, /\$\{SITE_URL\}\/omy-play/)
  assert.doesNotMatch(layout, /com\.otyaplayer\.app|otya-player|Otya Media|OtyaPoint/)
})

test('the site and its generated Open Graph card use the owner-approved permanent mark', () => {
  const mark = read('src/components/OtyaBrandMark.tsx')
  const sync = read('scripts/sync-brand-assets.mjs')
  const social = read('public/brand/otya-social-card.svg')
  const stylesheet = read('src/app/brand-overrides.css')
  assert.match(mark, /src="\/otya-app-icon\.webp"/)
  assert.match(sync, /EXPECTED_SHA256 = '34f8e6568b52900d8eaa7c30cd304770d60fb56745b6e2ed3874bc61ab205c51'/)
  assert.match(sync, /public\/og-image\.jpg/)
  assert.match(social, /#27E8FF/)
  assert.match(social, /#126BFF/)
  assert.match(social, /#173BFF/)
  assert.doesNotMatch(social, /#7C3AED|petersmartlink\.com|Otya Media/)
  assert.match(stylesheet, /--otya-cyan: #27E8FF/i)
  assert.match(stylesheet, /--otya-blue: #126BFF/i)
  assert.match(stylesheet, /--otya-deep-blue: #173BFF/i)
})
