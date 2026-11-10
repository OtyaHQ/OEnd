import test from 'node:test'
import assert from 'node:assert/strict'
import { commitVerifiedEmailChange } from '../auth-worker/src/email-change-commit.mjs'

test('email-change commit revokes refresh sessions before and after the email update', async () => {
  const events = []
  const result = await commitVerifiedEmailChange({
    revokeSessions: async () => { events.push('revoke') },
    updatePrimaryEmail: async () => { events.push('update'); return { updated: true } },
  })

  assert.deepEqual(events, ['revoke', 'update', 'revoke'])
  assert.deepEqual(result, { updated: true, sessionsRevoked: true })
})

test('email remains unchanged when the initial session revocation fails', async () => {
  let updateCalled = false
  await assert.rejects(() => commitVerifiedEmailChange({
    revokeSessions: async () => { throw new Error('KV unavailable') },
    updatePrimaryEmail: async () => { updateCalled = true; return { updated: true } },
  }), /KV unavailable/)
  assert.equal(updateCalled, false)
})

test('a conditional email update conflict reports that sessions were already revoked', async () => {
  const events = []
  const result = await commitVerifiedEmailChange({
    revokeSessions: async () => { events.push('revoke') },
    updatePrimaryEmail: async () => { events.push('update'); return { updated: false } },
  })

  assert.deepEqual(events, ['revoke', 'update'])
  assert.deepEqual(result, { updated: false, sessionsRevoked: true })
})

test('an update exception reports the existing session-revocation state', async () => {
  const result = await commitVerifiedEmailChange({
    revokeSessions: async () => {},
    updatePrimaryEmail: async () => { throw new Error('unique constraint failed') },
  })

  assert.equal(result.updated, false)
  assert.equal(result.sessionsRevoked, true)
  assert.match(String(result.updateError), /unique constraint/)
})

test('an incomplete second revocation is reported without hiding the committed email change', async () => {
  let calls = 0
  const result = await commitVerifiedEmailChange({
    revokeSessions: async () => {
      calls += 1
      if (calls === 2) throw new Error('KV temporarily unavailable')
    },
    updatePrimaryEmail: async () => ({ updated: true }),
  })

  assert.equal(result.updated, true)
  assert.equal(result.sessionsRevoked, false)
  assert.match(String(result.revocationError), /KV temporarily unavailable/)
})
