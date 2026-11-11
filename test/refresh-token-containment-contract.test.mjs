import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('production auth wraps normal Otya identity routes in the refresh-safe KV boundary', () => {
  const entry = read('auth-worker/src/production-entrypoint-miniapp.ts')
  assert.match(entry, /createRefreshSafeKv/)
  assert.match(entry, /AUTH_KV: createRefreshSafeKv\(rawEnv\.AUTH_KV\)/)
  assert.match(entry, /worker\.fetch\(request, authEnv\)/)
  assert.match(entry, /TELEGRAM_LOGIN_DISABLED/)
  assert.match(entry, /disabledTelegramAuth/)
  assert.doesNotMatch(entry, /handleTelegramMiniApp|handleTelegramPrimaryLogin/)
})

test('new refresh-token KV indexes contain only one-way versioned digests', () => {
  const store = read('auth-worker/src/refresh-token-store.ts')
  assert.match(store, /CURRENT_TOKEN_PREFIX = 'rt2:'/)
  assert.match(store, /CURRENT_USER_PREFIX = 'rt_user2:'/)
  assert.match(store, /crypto\.subtle\.digest/)
  assert.match(store, /SHA-256/)
  assert.match(store, /CURRENT_TOKEN_PREFIX/)
  assert.match(store, /CURRENT_USER_PREFIX/)
  assert.match(store, /MAX_USER_REFRESH_INDEXES = 5000/)
  assert.match(store, /cursor = page\.list_complete \? undefined : page\.cursor/)
})

test('session metadata no longer persists the bearer refresh token', () => {
  const sessions = read('auth-worker/src/session-manager.ts')
  const recordStart = sessions.indexOf('const record: SessionRecord')
  const recordEnd = sessions.indexOf('await Promise.all([', recordStart)
  const recordBlock = sessions.slice(recordStart, recordEnd)
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
  assert.match(store, /auth_session:/)
  assert.match(store, /auth_session_token:/)
})
