import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../migrations/20261118_email_login_challenges.sql', import.meta.url), 'utf8')
const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
const source = readFileSync(new URL('../src/secure-otp.ts', import.meta.url), 'utf8')

test('email sign-in challenge schema stores only an HMAC digest and references the identity user', () => {
  for (const sql of [migration, schema]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS auth_email_login_challenges/)
    assert.match(sql, /user_id TEXT PRIMARY KEY/)
    assert.match(sql, /code_digest TEXT NOT NULL/)
    assert.match(sql, /FOREIGN KEY \(user_id\) REFERENCES users\(id\) ON DELETE CASCADE/)
    assert.doesNotMatch(sql, /\bplaintext_code\b|\botp_code\b/i)
  }
})

test('email sign-in challenge is consumed by one atomic D1 DELETE RETURNING statement', () => {
  assert.match(source, /DELETE FROM auth_email_login_challenges[\s\S]*?WHERE user_id = \?1 AND code_digest = \?2 AND expires_at > \?3[\s\S]*?RETURNING user_id/)
  assert.doesNotMatch(source, /secure_login_otp:/)
})
