import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const signIn = read('src/app/sign-in/page.tsx')
const adminLayout = read('src/app/admin/layout.tsx')
const router = read('src/production-router.mjs')
const home = read('src/app/page.tsx')
const telegramBot = read('src/telegram-entrypoint.mjs')

test('owner factors are resolved by the authenticated Otya sign-in journey', () => {
  assert.match(signIn, /async function routeAuthenticatedSession\(\)/)
  assert.match(signIn, /await beginOwnerVerification\(\)/)
  assert.match(signIn, /mode === 'owner-otp'/)
  assert.match(signIn, /mode === 'owner-telegram'/)
  assert.match(signIn, /data\.telegram_challenge/)
  assert.match(signIn, /https:\/\/t\.me\/OtyaPlayerBot\?start=owner_/)
  assert.match(signIn, /I've confirmed in Telegram/)
  assert.doesNotMatch(signIn, /startOwnerTelegram|startTelegram\(/)
  assert.doesNotMatch(signIn, /\/api\/auth\/telegram\/start\?mode=(?:login|admin)/)
})

test('owner second factor uses a linked Telegram bot challenge, not Telegram OAuth sign-in', () => {
  assert.match(telegramBot, /ownerChallengeFromUpdate/)
  assert.ok(telegramBot.includes('owner_([A-Za-z0-9_-]{16,80})'))
  assert.match(telegramBot, /auth\/admin\/telegram-challenge\/confirm/)
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
