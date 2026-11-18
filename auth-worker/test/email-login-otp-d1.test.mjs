import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../migrations/20261118_email_login_challenges.sql', import.meta.url), 'utf8')
const source = readFileSync(new URL('../src/secure-otp.ts', import.meta.url), 'utf8')

function createDatabase() {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE users (id TEXT PRIMARY KEY)')
  db.prepare('INSERT INTO users (id) VALUES (?)').run('user-1')
  db.exec(migration)
  return db
}

function issue(db, digest, issuedAt, expiresAt) {
  db.prepare(\`
    INSERT INTO auth_email_login_challenges (user_id, code_digest, issued_at, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      code_digest = excluded.code_digest,
      issued_at = excluded.issued_at,
      expires_at = excluded.expires_at
  \`).run('user-1', digest, issuedAt, expiresAt)
}

function claimStatement() {
  // Execute the exact production DELETE RETURNING statement, including its
  // real predicate; translate only numbered bindings for node:sqlite.
  const start = source.indexOf('DELETE FROM auth_email_login_challenges\\n      WHERE user_id = ?1 AND code_digest = ?2 AND expires_at > ?3')
  assert.notEqual(start, -1, 'atomic challenge claim statement must exist in production source')
  const endMarker = 'RETURNING user_id'
  const end = source.indexOf(endMarker, start)
  assert.notEqual(end, -1, 'atomic challenge claim must return the claimed row')
  return source.slice(start, end + endMarker.length)
    .replace(/\?1/g, '?')
    .replace(/\?2/g, '?')
    .replace(/\?3/g, '?')
}

test('a D1 email login challenge can only be claimed once', () => {
  const db = createDatabase()
  try {
    const now = Math.floor(Date.now() / 1000)
    issue(db, 'hmac-sha256:approved-digest', now, now + 600)
    const consume = db.prepare(claimStatement())
    assert.equal(consume.get('user-1', 'hmac-sha256:approved-digest', now).user_id, 'user-1')
    assert.equal(consume.get('user-1', 'hmac-sha256:approved-digest', now), undefined)
  } finally {
    db.close()
  }
})

test('wrong and expired digests cannot consume a D1 email login challenge', () => {
  const db = createDatabase()
  try {
    const now = Math.floor(Date.now() / 1000)
    issue(db, 'hmac-sha256:approved-digest', now - 700, now - 100)
    const consume = db.prepare(claimStatement())
    assert.equal(consume.get('user-1', 'hmac-sha256:wrong-digest', now), undefined)
    assert.equal(consume.get('user-1', 'hmac-sha256:approved-digest', now), undefined)
  } finally {
    db.close()
  }
})

test('issuing a new challenge supersedes the previous digest for that account', () => {
  const db = createDatabase()
  try {
    const now = Math.floor(Date.now() / 1000)
    issue(db, 'hmac-sha256:old', now, now + 600)
    issue(db, 'hmac-sha256:new', now + 1, now + 601)
    const consume = db.prepare(claimStatement())
    assert.equal(consume.get('user-1', 'hmac-sha256:old', now + 1), undefined)
    assert.equal(consume.get('user-1', 'hmac-sha256:new', now + 1).user_id, 'user-1')
  } finally {
    db.close()
  }
})

test('production code claims challenges with a conditional DELETE RETURNING', () => {
  const statement = claimStatement()
  assert.match(statement, /WHERE user_id = \?1 AND code_digest = \?2 AND expires_at > \?3/)
  assert.match(statement, /RETURNING user_id$/)
})
