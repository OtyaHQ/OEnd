import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const constants=read('src/lib/constants.ts'), product=read('src/app/omy-play/page.tsx'), help=read('src/app/help/page.tsx'), admin=read('src/app/admin/ai/ConsoleClient.tsx')
const publicVisible=constants+'\n'+product+'\n'+help
test('public brand uses Otya and Omy Play with Send language', () => {
  assert.match(constants,/name: 'Otya'/)
  assert.match(constants,/player: 'Omy Play'/)
  assert.match(constants,/auth: 'OID'/)
  assert.match(constants,/nearby Send/)
  assert.match(product,/Omy Play/)
  assert.match(product,/\['Send'/)
  assert.match(product,/>Help & support</)
  assert.match(help,/Send is not connecting/)
  assert.match(help,/>OID</)
})
test('consumer surfaces do not expose owner assistant entry points', () => {
  assert.doesNotMatch(product,/href="\/ask"/)
  assert.doesNotMatch(help,/href="\/ask"/)
  assert.doesNotMatch(product,/\['O',/)
  assert.doesNotMatch(help,/>O<\/a>/)
  assert.doesNotMatch(publicVisible,/name: 'OTYA'|auth: 'OTYA Account'/)
  assert.match(admin,/What should O handle\?/)
})
