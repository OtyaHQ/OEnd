import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const otp = readFileSync(new URL('../src/secure-otp.ts', import.meta.url), 'utf8')
const entry = readFileSync(new URL('../src/production-entrypoint.ts', import.meta.url), 'utf8')

test('Otya ID exposes the email-only sign-in OTP endpoints used by OtyaPoint', () => {
  assert.ok(otp.includes("'/auth/login/otp/request'"))
  assert.ok(otp.includes("'/auth/login/otp/verify'"))
  assert.ok(entry.includes("'/auth/login/otp/request'"))
  assert.ok(entry.includes("'/auth/login/otp/verify'"))
})

test('login OTP requests are generic and rate-limited by email and source IP', () => {
  assert.ok(otp.includes('GENERIC_LOGIN_MESSAGE'))
  assert.ok(otp.includes('secure_otp_send:login:${email}'))
  assert.ok(otp.includes('secure_otp_send_ip:login:${ip}'))
  assert.ok(otp.includes('LOGIN_OTP_SEND_LIMIT'))
  assert.ok(otp.includes('LOGIN_OTP_IP_SEND_LIMIT'))
  assert.ok(otp.includes('return json({ ok: true, message: GENERIC_LOGIN_MESSAGE }, 202)'))
})

test('email login challenges store purpose-bound HMAC digests in D1 and require verified accounts', () => {
  assert.ok(otp.includes("digestCode(env, 'email-login', user.id, code)"))
  assert.ok(otp.includes('INSERT INTO auth_email_login_challenges'))
  assert.ok(otp.includes('expires_at = excluded.expires_at'))
  assert.ok(otp.includes('user.is_verified !== 1'))
  assert.ok(otp.includes('expires_at > ?3'))
  assert.ok(otp.includes('^[A-Z][0-9]{4}$'))
})

test('email sign-in delivery uses the generated code and cleans up an undelivered challenge', () => {
  assert.ok(otp.includes("'Your Otya sign-in code'"))
  assert.ok(otp.includes("'Use this one-time code to sign in to your Otya account:', code)"))
  assert.ok(otp.includes('DELETE FROM auth_email_login_challenges WHERE user_id = ?1 AND code_digest = ?2'))
})

test('verification atomically consumes the challenge before creating refresh session records', () => {
  assert.ok(otp.includes('secure_otp_attempt:login:${email}:${ip}'))
  assert.ok(otp.includes('secure_otp_attempt_global:login:${email}'))
  assert.ok(otp.includes('DELETE FROM auth_email_login_challenges'))
  assert.ok(otp.includes('RETURNING user_id'))
  assert.ok(otp.includes('access_token: accessToken'))
  assert.ok(otp.includes('refresh_token: refreshToken'))
  assert.ok(otp.includes('rt_user:${user.id}:${refreshToken}'))
  assert.ok(!otp.includes('secure_login_otp:'))
})

test('successful OTP sign-in triggers the existing new-device security email', () => {
  assert.ok(entry.includes("url.pathname === '/auth/login/otp/verify' && secureOtpResponse.ok"))
  assert.ok(entry.includes('deliverNewDeviceAlert(request, secureOtpResponse, env)'))
})

test('identity schema readiness is checked before processing login OTP routes', () => {
  const call = entry.indexOf('if (createsIdentitySession(request, url))')
  const secureOtp = entry.indexOf('handleSecureOtpRoute(request, env)')
  assert.ok(call >= 0 && secureOtp > call)
})

test('login OTP email pattern matches normal email addresses and rejects whitespace', () => {
  const match = otp.match(/^const EMAIL_RE = (.*)$/m)
  assert.ok(match)
  const re = new RegExp(match[1].replaceAll('/', '').replace(/;$/, ''))
  assert.ok(re.test('staff@example.com'))
  assert.ok(!re.test(' staff@example.com '))
})
