import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
test('public Status uses canonical Otya naming and exposes safe service meaning', () => {
  const status=read('src/app/status/page.tsx'), client=read('src/app/status/StatusClient.tsx')
  assert.match(status,/title: 'Otya Status'/)
  assert.match(status,/Otya service availability/)
  assert.match(status,/LiveStatusPanel/)
  assert.match(client,/Local playback/)
  assert.match(client,/device-first/)
  for(const source of [status,client]) assert.doesNotMatch(source,/OTYA|music-provider|D1|KV namespace|R2 bucket|Worker binding|Cloudflare account/i)
})
test('public Help teaches the current one-account and verification flow', () => {
  const help=read('src/app/help/page.tsx')
  assert.match(help,/title: 'Help \| Omy Play'/)
  assert.match(help,/Email, Google and Telegram can be linked to one OID account/)
  assert.match(help,/Registration sends one verification code automatically/)
  assert.match(help,/request a new code only if you still need one/)
  assert.match(help,/OID/)
  assert.match(help,/Contact Otya/)
  assert.doesNotMatch(help,/use Resend only|Telegram sign-in is not shown until|OTYA/i)
})
