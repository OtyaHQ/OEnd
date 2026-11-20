import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../auth-worker/src/production-entrypoint.ts', import.meta.url), 'utf8')

test('production auth fails closed when identity schema is unavailable', () => {
  assert.match(source, /import \{ assertSchemaReady, assertEmailLoginOtpSchemaReady \} from '\.\/db'/)
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
  const telegramIndex = source.indexOf("url.pathname.startsWith('/auth/telegram/')")
  const schemaIndex = source.indexOf('if (createsIdentitySession(request, url))')
  assert.ok(adminIndex >= 0 && adminIndex < schemaIndex)
  assert.ok(telegramIndex >= 0 && telegramIndex < schemaIndex)
})


test('email OTP readiness is separate and does not block existing identity login routes', () => {
  assert.match(source, /let emailLoginOtpSchemaReady: Promise<void> \| null = null/)
  assert.match(source, /assertEmailLoginOtpSchemaReady\(env\.AUTH_DB\)/)
  assert.match(source, /ensureEmailLoginOtpSchema\(env\)/)
  assert.match(source, /EMAIL_OTP_SCHEMA_UNAVAILABLE/)
  const otpGate = source.indexOf("&& ['/auth/login/otp/request', '/auth/login/otp/verify']")
  const googleRoute = source.indexOf("if (request.method === 'POST' && url.pathname === '/auth/google')")
  assert.ok(otpGate >= 0 && googleRoute > otpGate)
  const identityRoutes = source.slice(source.indexOf('function createsIdentitySession'), source.indexOf('async function verifiedGooglePayload'))
  assert.match(identityRoutes, /\['\/auth\/register', '\/auth\/login', '\/auth\/google'\]/)
  assert.doesNotMatch(identityRoutes, /otp/)
})
