import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('production auth accepts only configured Android and Web Google audiences', () => {
  const wrapper = read('src/production-entrypoint.ts')
  const config = read('wrangler.toml')

  assert.match(config, /GOOGLE_CLIENT_ID = "82776565585-77b1t8epvmn3mpdvstdg1rtprlju4suv\.apps\.googleusercontent\.com"/)
  assert.match(config, /GOOGLE_WEB_CLIENT_ID = "82776565585-obr8k53b8n6djsggissv8qne81cm3u5u\.apps\.googleusercontent\.com"/)
  assert.match(wrapper, /configuredGoogleAudiences/)
  assert.match(wrapper, /isAllowedGoogleAudience/)
  assert.match(wrapper, /accounts\.google\.com/)
  assert.match(wrapper, /expiry <= now/)
  assert.match(wrapper, /email_verified/)
})

test('production auth uses the secure wrapper around hardened Firebase and Resend handlers', () => {
  const config = read('wrangler.toml')
  const secureWrapper = read('src/production-entrypoint-secure.ts')
  const hardenedWrapper = read('src/production-entrypoint.ts')
  const entrypoint = read('src/entrypoint.ts')
  const resend = read('src/resend.ts')

  assert.match(config, /^main = "src\\/production-entrypoint-secure\\.ts"$/m)
  assert.match(secureWrapper, /import worker from "\.\\/production-entrypoint"/)
  assert.match(secureWrapper, /createRefreshSafeKv/)
  assert.match(secureWrapper, /AUTH_KV:\\s*createRefreshSafeKv\\(env\\.AUTH_KV\\)/)
  assert.match(secureWrapper, /telegramSignInDisabled/)
  assert.match(secureWrapper, /status: 410/)
  assert.doesNotMatch(secureWrapper, /production-entrypoint-miniapp|handleTelegramLogin|handleTelegramMiniApp/)
  assert.match(hardenedWrapper, /handleSecureOtpRoute/)
  assert.match(hardenedWrapper, /handleSecureAccountRoute/)
  assert.match(config, /^FIREBASE_PROJECT_ID = "otya-player"$/m)
  assert.doesNotMatch(config, /binding\\s*=\\s*"EMAIL"|\\[\\[send_email\\]\\]/i)
  assert.match(entrypoint, /createEmailAdapter\\(env\\.RESEND_API_KEY\\)/)
  assert.match(resend, /https:\\/\\/api\\.resend\\.com\\/emails/)
  assert.match(resend, /if\\(!apiKey\\)throw new Error\\('RESEND_API_KEY is not configured'\\)/)
})

test('JWT verification is fail-closed for metadata, identity and expiry', () => {
  const crypto = read('src/crypto.ts')

  assert.match(crypto, /parts\.length !== 3 \|\| !secret/)
  assert.match(crypto, /\.alg !== 'HS256'/)
  assert.match(crypto, /\.typ !== 'JWT'/)
  assert.match(crypto, /typeof payload\.sub !== 'string'/)
  assert.match(crypto, /payload\.sub\.trim\(\)\.length === 0/)
  assert.match(crypto, /Number\.isSafeInteger\(payload\.iat\)/)
  assert.match(crypto, /Number\.isSafeInteger\(payload\.exp\)/)
  assert.match(crypto, /payload\.iat as number\) > now \+ 300/)
  assert.match(crypto, /payload\.exp as number\) <= now/)
  assert.match(crypto, /payload\.exp as number\) <= \(payload\.iat as number\)/)
})

test('password reset stays generic, single-use, expiring and revokes existing sessions', () => {
  const auth = read('src/index.ts')
  const hardenedOtp = read('src/secure-otp.ts')

  assert.match(auth, /If that email exists, an OTP has been sent\./)
  assert.match(auth, /otp:\$\{normalizedEmail\}/)
  assert.match(auth, /expirationTtl: OTP_TTL_SECS/)
  assert.match(auth, /storedOtp\.toUpperCase\(\) !== otp\.trim\(\)\.toUpperCase\(\)/)
  assert.match(auth, /await env\.AUTH_KV\.delete\(`otp:\$\{normalizedEmail\}`\)/)
  assert.match(auth, /await revokeAllRefreshTokens\(env\.AUTH_KV, user\.id\)/)
  assert.match(auth, /Password updated successfully\. Please sign in again\./)

  assert.match(hardenedOtp, /list\(\{ prefix: `rt_user:\$\{userId\}:`, limit: 1000, cursor \}\)/)
  assert.match(hardenedOtp, /auth_session:\$\{userId\}:\$\{sessionId\}/)
  assert.match(hardenedOtp, /auth_session_token:\$\{sessionId\}/)
  assert.match(hardenedOtp, /cursor = page\.list_complete \? undefined : page\.cursor/)
})

test('server credentials are never configured as source values', () => {
  const files = [
    read('wrangler.toml'),
    read('src/production-entrypoint-secure.ts'),
    read('src/production-entrypoint.ts'),
    read('src/entrypoint.ts'),
    read('src/resend.ts'),
  ].join('\n')

  assert.doesNotMatch(files, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/)
  assert.doesNotMatch(files, /\bre_[A-Za-z0-9_-]{20,}\b/)
})