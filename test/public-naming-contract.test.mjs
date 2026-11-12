import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

const constants = read('src/lib/constants.ts')
const product = read('src/app/omy-play/page.tsx')
const legacyProduct = read('src/app/otya-player/page.tsx')
const help = read('src/app/help/page.tsx')
const adminAi = read('src/app/admin/ai/ConsoleClient.tsx')

const publicVisible = constants + '\n' + product + '\n' + help

test('public brand uses Otya and Omy Play with separate backend and identity names', () => {
  assert.match(constants, /name: 'Otya'/)
  assert.match(constants, /player: 'Omy Play'/)
  assert.match(constants, /backend: 'Otya End'/)
  assert.match(constants, /auth: 'Otya ID'/)
  assert.match(constants, /website: 'https:\/\/otya\.site'/)
  assert.match(constants, /connected family of digital products and services/)
  assert.match(product, /nearby Transfer/)
  assert.match(product, /Omy Play/)
  assert.match(product, /https:\/\/otya\.site\/omy-play/)
  assert.match(legacyProduct, /redirect\('\/omy-play'\)/)
  assert.match(product, /Download Omy Play/)
  assert.match(help, /Send is not connecting/)
  assert.match(help, /Otya ID/)
})

test('consumer product and help surfaces do not expose private Next AI entry points', () => {
  assert.doesNotMatch(product, /href="\/ask"/)
  assert.doesNotMatch(help, /href="\/ask"/)
  assert.doesNotMatch(product, /\['Next'/)
  assert.doesNotMatch(help, />Next</)
  assert.doesNotMatch(publicVisible, /name: 'OTYA'/)
  assert.doesNotMatch(publicVisible, /auth: 'OTYA ID'/)
  assert.match(adminAi, /Next/)
})
