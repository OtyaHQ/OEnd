import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const wrapper = read('auth-worker/src/production-entrypoint.ts')
const email = read('auth-worker/src/production-email.ts')
const wrangler = read('auth-worker/wrangler.toml')

test('production auth keeps legacy Cloudflare email disabled', () => {
  assert.doesNotMatch(wrangler, /\[\[send_email\]\]|binding\s*=\s*"EMAIL"/i)
  assert.match(wrapper, /EMAIL: undefined/)
  assert.match(wrapper, /deliverRegistrationEmails/)
  assert.match(wrapper, /deliverNewDeviceAlert/)
})

test('registration verification uses Resend and an HMAC-only active OTP', () => {
  assert.match(email, /sendResendEmail/)
  assert.match(email, /otya-otp:verify-email:/)
  assert.match(email, /hmac-sha256:/)
  assert.match(email, /verify_otp:\$\{userId\}/)
  assert.match(email, /await env\.AUTH_KV\.delete\(key\)/)
  assert.doesNotMatch(email, /env\.EMAIL\s*(?:\.|\?|\[|\()/)
})

test('new-device alerts use isolated Resend state during legacy cleanup', () => {
  assert.match(email, /resend_last_login_ip:\$\{userId\}/)
  assert.match(email, /subject: 'New login to your Otya account'/)
  assert.match(email, /Otya Security <noreply@otya.site>/)
})
