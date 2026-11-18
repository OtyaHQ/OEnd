import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('passwordless sign-in exposes separate request and verify endpoints', () => {
  const auth = read('src/index.ts')
  const production = read('src/production-entrypoint.ts')

  assert.match(auth, /POST \/auth\/login\/otp\/request/)
  assert.match(auth, /POST \/auth\/login\/otp\/verify/)
  assert.match(auth, /path === '\/auth\/login\/otp\/request'/)
  assert.match(auth, /path === '\/auth\/login\/otp\/verify'/)
  assert.match(production, /'\/auth\/login\/otp\/request'/)
  assert.match(production, /'\/auth\/login\/otp\/verify'/)
})

test('OTP request does not reveal whether an account exists', () => {
  const auth = read('src/index.ts')
  const start = auth.indexOf('async function handleRequestEmailLoginOtp')
  const end = auth.indexOf('async function handleVerifyEmailLoginOtp', start)
  assert.ok(start >= 0 && end > start)
  const handler = auth.slice(start, end)

  assert.match(handler, /EMAIL_LOGIN_OTP_GENERIC_MESSAGE/)
  assert.match(handler, /jsonOk\(\{ ok: true, message: EMAIL_LOGIN_OTP_GENERIC_MESSAGE \}, env, 202, req\)/)
  assert.match(handler, /if \(!user\?\.email \|\| !env\.EMAIL\)/)
  assert.match(handler, /EMAIL_LOGIN_OTP_MAX_SENDS/)
  assert.match(handler, /EMAIL_LOGIN_OTP_MAX_SENDS_PER_IP/)
  assert.match(handler, /sha256Hex\(email\)/)
  assert.match(handler, /sha256Hex\(getClientIp\(req\)\)/)
})

test('email sign-in challenge stores only a keyed digest and expires in ten minutes', () => {
  const auth = read('src/index.ts')
  const start = auth.indexOf('async function handleRequestEmailLoginOtp')
  const end = auth.indexOf('async function handleVerifyEmailLoginOtp', start)
  const handler = auth.slice(start, end)

  assert.match(auth, /const EMAIL_LOGIN_OTP_TTL_SECS = 10 \* 60/)
  assert.match(auth, /name: 'HMAC', hash: 'SHA-256'/)
  assert.match(auth, /otya-email-login:/)
  assert.match(handler, /emailLoginOtpDigest\(env, user\.id, challengeId, email, code\)/)
  assert.match(handler, /code_digest/)
  assert.match(handler, /ON CONFLICT\(user_id\) DO UPDATE/)
  assert.match(handler, /EMAIL_LOGIN_OTP_GENERIC_MESSAGE/)
  assert.doesNotMatch(handler, /AUTH_KV\.put\([^\n]*code/)
})

test('verification conditionally consumes one challenge once and bounds attempts', () => {
  const auth = read('src/index.ts')
  const start = auth.indexOf('async function handleVerifyEmailLoginOtp')
  const end = auth.indexOf('/** POST /auth/refresh */', start)
  assert.ok(start >= 0 && end > start)
  const handler = auth.slice(start, end)

  assert.match(handler, /EMAIL_LOGIN_OTP_CODE_RE/)
  assert.match(handler, /EMAIL_LOGIN_OTP_MAX_VERIFY_PER_EMAIL/)
  assert.match(handler, /EMAIL_LOGIN_OTP_MAX_VERIFY_PER_IP/)
  assert.match(handler, /attempt_count < \?/)
  assert.match(handler, /status='PENDING'/)
  assert.match(handler, /datetime\(expires_at\) > datetime\('now'\)/)
  assert.match(handler, /consumed\.meta\.changes !== 1/)
  assert.match(handler, /status=CASE WHEN attempt_count\+1 >= \? THEN 'LOCKED' ELSE status END/)
  assert.match(handler, /SET is_verified=1/)
  assert.match(handler, /issueAccessToken\(user\.id, user\.email, env\.AUTH_JWT_SECRET\)/)
  assert.match(handler, /issueRefreshToken\(env\.AUTH_KV, user\.id\)/)
  assert.doesNotMatch(handler, /console\.log\([^\n]*code/)
})

test('email OTP sign-in passes the existing two-factor and session-registration gates', () => {
  const wrapper = read('src/entrypoint.ts')
  const production = read('src/production-entrypoint.ts')

  assert.match(wrapper, /\['\/auth\/login', '\/auth\/login\/otp\/verify'\]/)
  assert.match(wrapper, /verifySecondFactor\(/)
  assert.match(wrapper, /recordSessionFromAuthResponse\(request, response, env\)/)
  assert.match(production, /'\/auth\/login\/otp\/verify'/)
  assert.match(production, /deliverNewDeviceAlert\(request, response, env\)/)
})

test('challenge table is part of the schema snapshot, read-only readiness and additive migration', () => {
  const db = read('src/db.ts')
  const schema = read('schema.sql')
  const migration = read('migrations/20261118_email_login_challenges.sql')

  for (const source of [db, schema, migration]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS email_login_challenges/)
    assert.match(source, /code_digest TEXT NOT NULL/)
    assert.match(source, /status IN \('PENDING','CONSUMED','LOCKED','FAILED','EXPIRED'\)/)
  }
  assert.match(db, /FROM email_login_challenges LIMIT 0/)
  assert.match(migration, /REFERENCES users\(id\) ON DELETE CASCADE/)
  assert.match(migration, /idx_email_login_challenges_expiry/)
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM users|TRUNCATE/i)
})

test('security evidence distinguishes email-code request and completion', () => {
  const events = read('src/security-events.ts')
  assert.match(events, /'\/auth\/login\/otp\/request': 'email_otp_login_requested'/)
  assert.match(events, /'\/auth\/login\/otp\/verify': 'email_otp_login_verified'/)
})

test('unapplied OTP migration does not block existing password, registration or Google sign-in', () => {
  const production = read('src/production-entrypoint.ts')
  const start = production.indexOf('function createsIdentitySession')
  const end = production.indexOf('async function verifiedGooglePayload', start)
  const helper = production.slice(start, end)
  assert.match(helper, /\['\/auth\/register', '\/auth\/login', '\/auth\/google'\]/)
  assert.doesNotMatch(helper, /\/auth\/login\/otp\//)
  assert.match(production, /ensureEmailLoginOtpSchema/)
  assert.match(production, /EMAIL_OTP_SCHEMA_UNAVAILABLE/)
})
