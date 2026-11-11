import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/api/account-session/[...path]/route.ts', import.meta.url), 'utf8')

test('browser account proxy clears shared secure cookies when reauthentication is required', () => {
  assert.match(source, /data\.sign_in_again === true/)
  assert.match(source, /clearSessionCookies\(response\)/)
  assert.match(source, /__Secure-otya_access/)
  assert.match(source, /__Secure-otya_refresh/)
  assert.match(source, /httpOnly: true/)
  assert.match(source, /secure: true/)
  assert.match(source, /sameSite: 'lax'/)
  assert.doesNotMatch(source, /domain:/)
  assert.doesNotMatch(source, /COOKIE_DOMAIN/)
  assert.ok(source.includes("path: '/'") )
})
