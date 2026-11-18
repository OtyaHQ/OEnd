import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/telegram-login.ts', import.meta.url), 'utf8')

test('Telegram primary and admin sign-in requests are rejected before provider configuration', () => {
  const start = source.indexOf("if (requested === 'login' || requested === 'admin') return telegramSignInDisabled()")
  const config = source.indexOf('const oidcConfigured')
  assert.notEqual(start, -1)
  assert.notEqual(config, -1)
  assert.ok(start < config, 'login modes must be rejected before OIDC/widget setup')
  assert.match(source, /code: 'TELEGRAM_SIGN_IN_DISABLED'/)
  assert.match(source, /}, 410\)/)
})

test('Telegram linking requires an existing authenticated Otya bearer identity', () => {
  assert.match(source, /const mode: TelegramMode = 'link'/)
  assert.match(source, /const userId = await requireUser\(request, env\)/)
  assert.match(source, /if \(!userId\) return json\(\{ error: 'Sign in to OTYA first' \}, 401\)/)
  assert.match(source, /if \(existingIdentity && existingIdentity\.user_id !== userId\)/)
})

test('legacy login/admin callback state is rejected before token exchange or session issuance', () => {
  const oidcGuard = source.indexOf("if (stored.mode !== 'link' || !stored.userId) return telegramSignInDisabled()", source.indexOf('const stored = JSON.parse(storedRaw) as StoredTelegramState', source.indexOf('const state = url.searchParams.get(\'state\') || \'\'', source.indexOf('if (isWidgetCallback)')) + 1))
  const tokenExchange = source.indexOf('fetch(OIDC_TOKEN')
  assert.notEqual(oidcGuard, -1)
  assert.notEqual(tokenExchange, -1)
  assert.ok(oidcGuard < tokenExchange, 'legacy OIDC login state must not reach Telegram token exchange')

  assert.doesNotMatch(source, /issueBrowserTokens|generateRefreshToken|signJwt/)
  assert.match(source, /if \(stored\.mode !== 'link' \|\| !stored\.userId\) return telegramSignInDisabled\(\)/)
})

test('Telegram linked-account callback can only update the already authenticated account link', () => {
  assert.match(source, /INSERT INTO linked_identities \(user_id, provider, provider_subject, provider_username\)/)
  assert.match(source, /VALUES \(\?, 'telegram', \?, \?\)/)
  assert.match(source, /const userId = stored\.userId/)
  assert.doesNotMatch(source, /telegram_login: true/)
})
