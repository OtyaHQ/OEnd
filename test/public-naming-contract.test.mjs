import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

const constants = read('src/lib/constants.ts')
const media = read('src/app/omy-play/page.tsx')
const shop = read('src/app/opoint/page.tsx')
const help = read('src/app/help/page.tsx')
const adminO = read('src/app/admin/ai/ConsoleClient.tsx')
const publicVisible = [constants, media, shop, help].join('\n')

test('public product names are Omy Play and Opoint, with O as a private owner assistant', () => {
  assert.match(constants, /name: 'Otya'/)
  assert.match(constants, /player: 'Omy Play'/)
  assert.match(constants, /ai: 'O'/)
  assert.match(constants, /auth: 'Otya Account'/)
  assert.match(media, /Omy Play/)
  assert.match(shop, /Opoint/)
  assert.match(help, /Omy Play/)
  assert.equal(existsSync(new URL('../src/app/ask/page.tsx', import.meta.url)), false)
  assert.doesNotMatch(publicVisible, /Otya Media|OtyaPoint|Otya Next|Next/)
})

test('O is visible only in the owner console, not as a public assistant entry point', () => {
  assert.match(adminO, /O settings/)
  assert.match(adminO, /What should O handle/)
  assert.doesNotMatch(adminO, /Next/)
  assert.doesNotMatch(publicVisible, /href="\/ask"/)
})
