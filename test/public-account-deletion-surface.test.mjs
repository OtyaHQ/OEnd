import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const publicPage = readFileSync(new URL('../src/app/delete-account/page.tsx', import.meta.url), 'utf8')
const privacy = readFileSync(new URL('../src/app/privacy/page.tsx', import.meta.url), 'utf8')
const footer = readFileSync(new URL('../src/components/SiteFooter.tsx', import.meta.url), 'utf8')
const secureDeletion = readFileSync(new URL('../auth-worker/src/secure-account.ts', import.meta.url), 'utf8')

test('Otya exposes a dedicated public account deletion request page', () => {
  assert.match(publicPage, /https:\/\/otya\.site\/delete-account/)
  assert.match(publicPage, /public account-deletion request page/)
  assert.match(publicPage, /Me → Otya Account → Delete account/)
  assert.match(publicPage, /mailto:support@otya\.site\?subject=Otya%20account%20deletion%20request/)
  assert.match(publicPage, /no longer have the Android app installed/)
})

test('public deletion guidance is discoverable from privacy and legal navigation', () => {
  assert.match(privacy, /href="\/delete-account"/)
  assert.match(footer, /\['Delete account', '\/delete-account'\]/)
})

test('public deletion page does not expose or invoke the protected deletion endpoint', () => {
  assert.doesNotMatch(publicPage, /\/auth\/delete-account/)
  assert.doesNotMatch(publicPage, /fetch\(/)
  assert.match(publicPage, /Never send a password, one-time code, access token, refresh token, API key/)
})

test('actual destructive deletion remains authenticated and server-side', () => {
  assert.match(secureDeletion, /url\.pathname !== '\/auth\/delete-account'/)
  assert.match(secureDeletion, /request\.method !== 'POST'/)
  assert.match(secureDeletion, /Authorization/)
  assert.match(secureDeletion, /verifyJwt\(/)
  assert.match(secureDeletion, /notifyStoreDeletion\(/)
  assert.match(secureDeletion, /revokeEveryRefreshSession\(/)
  assert.match(secureDeletion, /deleteUser\(/)
})
