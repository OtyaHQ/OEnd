import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const signIn = read('src/app/sign-in/page.tsx')
const adminLayout = read('src/app/admin/layout.tsx')
const router = read('src/production-router.mjs')
const home = read('src/app/page.tsx')

test('owner factors are resolved by the authenticated Otya sign-in journey', () => {
  assert.match(signIn, /async function routeAuthenticatedSession\(\)/)
  assert.match(signIn, /await beginOwnerVerification\(\)/)
  assert.match(signIn, /mode === 'owner-otp'/)
  assert.match(signIn, /mode === 'owner-telegram'/)
})

test('browser admin routes stay unavailable while their protected backend boundary remains', () => {
  assert.match(router, /pathname === '\/admin'/)
  assert.match(router, /pathname\.startsWith\('\/admin\/'\)/)
  assert.match(adminLayout, /Owner control is in Next/)
  assert.doesNotMatch(adminLayout, /ConsoleClient/)
})

test('Otya is the public umbrella brand and the parent entity is clearly pending registration', () => {
  assert.match(home, /Meet Otya, a connected product and services ecosystem built in Uganda/)
  const company = read('src/app/company/page.tsx')
  assert.match(company, /Otya Holdings Limited is the intended parent entity/)
  assert.match(company, /URSB registration process/)
  assert.doesNotMatch(company, /Otya Holdings Limited is the (?:registered|incorporated) company/)
})
