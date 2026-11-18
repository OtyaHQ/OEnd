import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const otp = readFileSync(new URL('../src/secure-otp.ts', import.meta.url), 'utf8')
const entry = readFileSync(new URL('../src/production-entrypoint.ts', import.meta.url), 'utf8')

test('Otya ID exposes the email-only sign-in OTP endpoints used by OtyaPoint', () => {
  assert.match(otp, /'\/auth\/login\/otp\/request'/)
  assert.match(otp, /'\/auth\/login\/otp\/verify'/)
  assert.match(entry, /'\/auth\/login\/otp\/request'/)
  assert.match(entry, /'\/auth\/login\/otp\/verify'/)
})

test('login OTP requests are generic and rate-limited by email and source IP', () => {
  assert.match(otp, /GENERIC_LOGIN_MESSAGE/)
  assert.match(otp, /secure_otp_send:login:/)
  assert.match(otp, /secure_otp_send_ip:login:/)
  assert.match(otp, /LOGIN_OTP_SEND_LIMIT/)
  assert.match(otp, /LOGIN_OTP_IP_SEND_LIMIT/)
  assert.match(otp, /return json\\(\\{ ok: true, message: GENERIC_LOGIN_MESSAGE \\}, 202\\)/)
})

test('email login codes are purpose-bound HMAC digests, expire, and require a verified account', () => {
  assert.match(otp, /digestCode\\(env, 'email-login', email, code\\)/)
  assert.match(otp, /expirationTtl: OTP_TTL/)
  assert.match(otp, /user\\.is_verified === 1 \\|\\| user\\.is_verified === true/)
  assert.match(otp, /matchesStoredCode\\(env, stored, 'email-login', email, code\\)/)
})

test('login OTP verification is brute-force limited and consumes the code before creating a session', () => {
  assert.match(otp, /secure_otp_attempt:login:/)
  assert.match(otp, /secure_otp_attempt_global:login:/)
  assert.match(otp, /await env\\.AUTH_KV\\.delete\\(key\\)/)
  assert.match(otp, /access_token: accessToken/)
  assert.match(otp, /refresh_token: refreshToken/)
  assert.match(otp, /rt_user:\\$\\{user\\.id\\}:\\$\\{refreshToken\\}/)
})

test('successful OTP sign-in triggers the existing new-device security email', () => {
  assert.match(entry, /url\\.pathname === '\/auth\/login\/otp\/verify' && secureOtpResponse\\.ok/)
  assert.match(entry, /deliverNewDeviceAlert\\(request, secureOtpResponse, env\\)/)
})

test('identity schema readiness is checked before processing login OTP routes', () => {
  const call = entry.indexOf('if (createsIdentitySession(request, url))')
  const secureOtp = entry.indexOf('handleSecureOtpRoute(request, env)')
  assert.ok(call >= 0 && secureOtp > call)
})
