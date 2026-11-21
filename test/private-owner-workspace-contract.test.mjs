import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const askPage = readFileSync(new URL('../src/app/ask/page.tsx', import.meta.url), 'utf8')
const router = readFileSync(new URL('../src/production-router.mjs', import.meta.url), 'utf8')
const entry = readFileSync(new URL('../src/entrypoint.mjs', import.meta.url), 'utf8')
const ownerUi = readFileSync(new URL('../src/app/admin/ai/ConsoleClient.tsx', import.meta.url), 'utf8')

test('O deep links open the authenticated private owner workspace', () => {
  assert.match(askPage, /redirect\('\/admin\/ai'\)/)
  assert.match(router, /\['o', '\/admin\/ai\/'\]/)
  assert.match(router, /redirectToHost\(url, SPACE_HOST, '\/admin\/ai\/'\)/)
  assert.doesNotMatch(router, /\['o', '\/ask\/'\]/)
})

test('the public AI chat endpoint is deliberately owner-only', () => {
  assert.match(entry, /url\.pathname\.startsWith\('\/api\/ai\/chat'\)/)
  assert.match(entry, /error:'owner_only'/)
  assert.match(entry, /O is a private owner workspace/)
})

test('owner AI APIs require sign-in, administrator role and an elevated session', () => {
  assert.match(entry, /async function forwardAdminAi/)
  assert.match(entry, /if\(!user\)return json\(\{error:'Sign in required'\},401\)/)
  assert.match(entry, /if\(!isAdminUser\(user,env\)\)/)
  assert.match(entry, /hasElevatedAdminSession/)
  assert.match(ownerUi, /getAdminSession/)
  assert.match(ownerUi, /Owner verification is required/)
})

test('public navigation does not advertise an anonymous assistant chat', () => {
  const site = readFileSync(new URL('../src/app/apps/page.tsx', import.meta.url), 'utf8')
  assert.match(site, /Private owner workspace/)
  assert.match(site, /space\.otya\.site\/admin\/ai/)
  assert.doesNotMatch(site, /href="\/ask"/)
})
