import test from 'node:test'
import assert from 'node:assert/strict'
import { commitVerifiedEmailChange } from '../auth-worker/src/email-change-commit.mjs'

test('email-change commit uses KV and D1 adapters in revoke-update-revoke order', async () => {
  const events = []
  const userId = 'otya-user-1'
  const sessions = new Map([
    [`rt:old-token`, userId],
    [`rt_user:${userId}:old-token`, '1'],
  ])

  const kv = {
    async list({ prefix }) {
      events.push('kv.list')
      return { keys: [...sessions.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true }
    },
    async delete(key) {
      events.push(`kv.delete:${key}`)
      sessions.delete(key)
    },
  }
  const d1 = {
    prepare(sql) {
      events.push('d1.prepare')
      assert.match(sql, /^UPDATE users SET email = \?, is_verified = 1/)
      return {
        bind(...values) {
          events.push('d1.bind')
          assert.deepEqual(values, ['otyaug@gmail.com', userId, 'petersmartlink@gmail.com'])
          return {
            async run() {
              events.push('d1.update')
              // Simulate a refresh session issued in the small window between
              // the first revocation and the conditional D1 email update.
              sessions.set('rt:racing-token', userId)
              sessions.set(`rt_user:${userId}:racing-token`, '1')
              return { meta: { changes: 1 } }
            },
          }
        },
      }
    },
  }

  const revokeSessions = async () => {
    events.push('revoke:start')
    const page = await kv.list({ prefix: `rt_user:${userId}:` })
    for (const entry of page.keys) {
      const token = entry.name.slice(`rt_user:${userId}:`.length)
      await kv.delete(`rt:${token}`)
      await kv.delete(entry.name)
    }
    events.push('revoke:complete')
  }

  const result = await commitVerifiedEmailChange({
    revokeSessions,
    updatePrimaryEmail: async () => {
      const update = await d1.prepare(
        'UPDATE users SET email = ?, is_verified = 1, updated_at = datetime(\'now\') WHERE id = ? AND email = ?',
      ).bind('otyaug@gmail.com', userId, 'petersmartlink@gmail.com').run()
      return { updated: Number(update.meta.changes) === 1 }
    },
  })

  assert.deepEqual(events.filter(event => event === 'revoke:start' || event === 'd1.update'), [
    'revoke:start',
    'd1.update',
    'revoke:start',
  ])
  assert.equal(sessions.size, 0, 'the second KV revocation must remove a session issued during the D1 update window')
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
