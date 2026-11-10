import test from 'node:test'
import assert from 'node:assert/strict'
import { consumeVerifiedTelegramIdentityLink } from '../auth-worker/src/telegram-link-proof.mjs'

async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function mockDB(initial = []) {
  const proofs = new Map(initial.map(row => [row.user_id, { ...row }]))
  return {
    proofs,
    prepare(sql) {
      assert.match(sql, /DELETE FROM telegram_identity_link_proofs/)
      assert.match(sql, /expires_at > datetime\('now'\)/)
      assert.match(sql, /RETURNING user_id/)
      return {
        bind(userId, emailHash) {
          return {
            async first() {
              const proof = proofs.get(userId)
              if (!proof || proof.email_hash !== emailHash || proof.expired) return null
              proofs.delete(userId)
              return { user_id: userId }
            },
          }
        },
      }
    },
  }
}

test('consumes a proof only for the same normalized current email', async () => {
  const email = 'owner@example.com'
  const db = mockDB([{ user_id: 'user-1', email_hash: await sha256Hex(email) }])
  assert.equal(await consumeVerifiedTelegramIdentityLink({
    db, userId: 'user-1', currentEmail: 'Owner@Example.com',
  }), true)
  assert.equal(db.proofs.has('user-1'), false)
})

test('a changed email cannot consume the proof', async () => {
  const db = mockDB([{ user_id: 'user-2', email_hash: await sha256Hex('old@example.com') }])
  assert.equal(await consumeVerifiedTelegramIdentityLink({
    db, userId: 'user-2', currentEmail: 'new@example.com',
  }), false)
  assert.equal(db.proofs.has('user-2'), true)
})

test('proof consumption is one-use and safe against replay', async () => {
  const db = mockDB([{ user_id: 'user-3', email_hash: await sha256Hex('owner@example.com') }])
  const input = { db, userId: 'user-3', currentEmail: 'owner@example.com' }
  const results = await Promise.all([
    consumeVerifiedTelegramIdentityLink(input),
    consumeVerifiedTelegramIdentityLink(input),
  ])
  assert.equal(results.filter(Boolean).length, 1)
  assert.equal(await consumeVerifiedTelegramIdentityLink(input), false)
})

test('missing email and expired proof are rejected', async () => {
  const db = mockDB([{ user_id: 'user-4', email_hash: await sha256Hex('owner@example.com'), expired: true }])
  assert.equal(await consumeVerifiedTelegramIdentityLink({
    db, userId: 'user-4', currentEmail: null,
  }), false)
  assert.equal(await consumeVerifiedTelegramIdentityLink({
    db, userId: 'user-4', currentEmail: 'owner@example.com',
  }), false)
})

test('email challenge is consumed atomically by its HMAC digest', async () => {
  const emailHash = await sha256Hex('owner@example.com')
  const row = { user_id: 'user-5', email_hash: emailHash, otp_digest: 'hmac-sha256:one-use', expired: false }
  const rows = new Map([['user-5', row]])
  const db = {
    prepare(sql) {
      assert.match(sql, /DELETE FROM telegram_identity_link_challenges/)
      assert.match(sql, /otp_digest = \?/)
      assert.match(sql, /RETURNING user_id/)
      return {
        bind(userId, hash, digest) {
          return {
            async first() {
              const current = rows.get(userId)
              if (!current || current.email_hash !== hash || current.otp_digest !== digest || current.expired) return null
              rows.delete(userId)
              return { user_id: userId }
            },
          }
        },
      }
    },
  }
  const { consumeTelegramIdentityEmailChallenge } = await import('../auth-worker/src/telegram-link-proof.mjs')
  const input = { db, userId: 'user-5', currentEmail: 'owner@example.com', otpDigest: 'hmac-sha256:one-use' }
  const results = await Promise.all([
    consumeTelegramIdentityEmailChallenge(input),
    consumeTelegramIdentityEmailChallenge(input),
  ])
  assert.equal(results.filter(Boolean).length, 1)
  assert.equal(await consumeTelegramIdentityEmailChallenge(input), false)
})
