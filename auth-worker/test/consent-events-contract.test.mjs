import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('auth consent endpoint stores versioned policy events and returns the signed-in users own history', () => {
  const consent = read('src/consent.ts')
  const entrypoint = read('src/entrypoint.ts')

  assert.match(consent, /CREATE TABLE IF NOT EXISTS consent_events/)
  assert.match(consent, /policy_type IN \('terms', 'privacy', 'marketing'\)/)
  assert.match(consent, /action IN \('accepted', 'declined', 'withdrawn'\)/)
  assert.match(consent, /idx_consent_events_user_date/)
  assert.match(consent, /crypto\.randomUUID\(\)/)
  assert.match(consent, /recordConsentEvent\(env\.AUTH_DB, userId, 'terms', TERMS_VERSION, 'accepted'/)
  assert.match(consent, /recordConsentEvent\(env\.AUTH_DB, userId, 'privacy', PRIVACY_VERSION, 'accepted'/)
  assert.match(consent, /marketingConsent \? 'accepted' : 'declined'/)
  assert.match(consent, /body\.marketing_consent \? 'accepted' : 'withdrawn'/)
  assert.match(consent, /readConsentHistory\(env\.AUTH_DB, userId\)/)
  assert.match(entrypoint, /handleConsentRoute\(request, env\)/)
  assert.match(entrypoint, /recordRegistrationConsent\(env, userId, marketingConsent\)/)
})

test('marketing preference remains optional and distinct from mandatory service-policy acceptance', () => {
  const consent = read('src/consent.ts')
  assert.match(consent, /marketing_consent INTEGER NOT NULL DEFAULT 0/)
  assert.match(consent, /if \(hasMarketing && typeof body\.marketing_consent !== 'boolean'\)/)
  assert.match(consent, /marketing_consent: 0/)
})
