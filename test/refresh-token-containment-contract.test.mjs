import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('production Auth blocks retired Telegram sign-in and wraps the worker in refresh-safe KV', () => {
  const entry = read('auth-worker/src/production-entrypoint-secure.ts')
  assert.match(entry, /createRefreshSafeKv/)
  assert.match(entry, /AUTH_KV: createRefreshSafeKv\(env\.AUTH_KV\)/)
  assert.match(entry, /telegramSignInDisabled/)
  assert.match(entry, /return worker\.fetch\(request, safeEnv, ctx\)/)
  assert.doesNotMatch(entry, /handleTelegramMiniApp|handleTelegramPrimaryLogin/)
})
test('new refresh-token KV indexes contain only one-way versioned digests', () => {
  const store = read('auth-worker/src/refresh-token-store.ts')
  assert.match(store, /CURRENT_TOKEN_PREFIX = 'rt2:'/)
  assert.match(store, /CURRENT_USER_PREFIX = 'rt_user2:'/)
  assert.match(store, /crypto\.subtle\.digest/)
  assert.match(store, /SHA-256/)
  assert.match(store, /kv\.put\(`\$\{CURRENT_TOKEN_PREFIX\}\$\{digest\}`/)
  assert.match(store, /kv\.put\(`\$\{CURRENT_USER_PREFIX\}\$\{userId\}:\$\{digest\}`/)
  assert.match(store, /const current = await kv\.get\(`\$\{CURRENT_TOKEN_PREFIX\}\$\{digest\}`\)/)
  assert.match(store, /return kv\.get\(key\)/)
  assert.match(store, /MAX_USER_REFRESH_INDEXES = 5000/)
  assert.match(store, /cursor = page\.list_complete \? undefined : page\.cursor/)
})

test('session metadata no longer persists the bearer refresh token', () => {
  const sessions = read('auth-worker/src/session-manager.ts')
  const recordBlock = sessions.slice(
    sessions.indexOf('const record: SessionRecord'),
    sessions.indexOf('await Promise.all([', sessions.indexOf('const record: SessionRecord')),
  )
  assert.match(recordBlock, /tokenDigest/)
  assert.doesNotMatch(recordBlock, /refreshToken\s*,/)
  assert.match(sessions, /refreshTokenDigest\(parsed\.refreshToken\)/)
  assert.match(sessions, /overwrite the session record/)
  assert.match(sessions, /revokeRefreshTokenByDigest/)
})

test('account-wide revocation understands v2 synthetic indexes and cleans session metadata', () => {
  const account = read('auth-worker/src/secure-account.ts')
  const store = read('auth-worker/src/refresh-token-store.ts')
  assert.match(account, /sessionIdForRefreshIndexSuffix/)
  assert.match(store, /SYNTHETIC_V2_SUFFIX = 'v2\.'/)
  assert.match(store, /removeSessionMetadata/)
  assert.match(store, /auth_session:\$\{userId\}:\$\{sessionId\}/)
  assert.match(store, /auth_session_token:\$\{sessionId\}/)
})
