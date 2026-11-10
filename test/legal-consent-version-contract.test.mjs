import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const CURRENT_LEGAL_VERSION = '2026-11-10'

test('registration and auth record acceptance of the legal version currently shown to users', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  const consent = read('auth-worker/src/consent.ts')
  const privacy = read('src/app/privacy/page.tsx')
  const terms = read('src/app/terms/page.tsx')

  assert.match(signIn, new RegExp(`TERMS_VERSION = '${CURRENT_LEGAL_VERSION}'`))
  assert.match(signIn, new RegExp(`PRIVACY_VERSION = '${CURRENT_LEGAL_VERSION}'`))
  assert.match(consent, new RegExp(`TERMS_VERSION = '${CURRENT_LEGAL_VERSION}'`))
  assert.match(consent, new RegExp(`PRIVACY_VERSION = '${CURRENT_LEGAL_VERSION}'`))
  assert.match(privacy, /Last updated November 10, 2026/)
  assert.match(terms, /Last updated November 10, 2026/)
  assert.match(privacy, /Peter Katabira/)
  assert.match(terms, /Peter Katabira/)
  assert.match(terms, /Otya Holdings Limited/)
  assert.match(terms, /registration is in progress/)
})
