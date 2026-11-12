import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../auth-worker/src/production-entrypoint.ts', import.meta.url), 'utf8')
const secure = readFileSync(new URL('../auth-worker/src/production-entrypoint-secure.ts', import.meta.url), 'utf8')

test('production auth fails closed when identity schema is unavailable', () => {
  assert.match(source, /import \{ assertSchemaReady \} from '\.\/db'/)
  assert.match(source, /let identitySchemaReady: Promise<void> \| null = null/)
  assert.match(source, /identitySchemaReady = assertSchemaReady\(env\.AUTH_DB\)\.catch/)
  assert.match(source, /identitySchemaReady = null/)
  assert.match(source, /AUTH_SCHEMA_UNAVAILABLE/)
  assert.match(source, /Otya Account is temporarily unavailable/)
  assert.match(source, /503/)
})

test('schema readiness guards only session-creating identity writes', () => {
  assert.match(source, /function createsIdentitySession\(request: Request, url: URL\)/)
  assert.match(source, /\['\/auth\/register', '\/auth\/login', '\/auth\/google'\]/)
  assert.match(source, /if \(createsIdentitySession\(request, url\)\) \{/)
})

test('security and provider handlers run before schema readiness', () => {
  const adminIndex = source.indexOf("url.pathname.startsWith('/auth/admin/')")
  const schemaIndex = source.indexOf('if (createsIdentitySession(request, url))')
  assert.ok(adminIndex >= 0 && adminIndex < schemaIndex)
})

test('legacy Telegram sign-in is rejected before the Auth worker or schema can run', () => {
  const denyIndex = secure.indexOf('if (telegramSignInPath) return telegramSignInDisabled()')
  const dispatchIndex = secure.indexOf('return worker.fetch(request, safeEnv, ctx)')
  assert.ok(denyIndex >= 0 && dispatchIndex > denyIndex)
  assert.match(secure, /status: 410/)
})
