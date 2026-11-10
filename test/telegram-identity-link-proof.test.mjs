import test from 'node:test'
import assert from 'node:assert/strict'
import { consumeVerifiedTelegramIdentityLink } from '../auth-worker/src/telegram-link-proof.mjs'

function mockKV(initial = {}) {
  const values = new Map(Object.entries(initial))
  const deleted = []
  return {
    values,
    deleted,
    async get(key) { return values.get(key) ?? null },
    async delete(key) { deleted.push(key); values.delete(key) },
  }
}

test('consumes a proof only for the same verified current email', async () => {
  const kv = mockKV({ 'telegram_identity_link_verified:user-1': 'owner@example.com' })
  assert.equal(await consumeVerifiedTelegramIdentityLink({
    kv, userId: 'user-1', currentEmail: 'Owner@Example.com',
  }), true)
  assert.equal(kv.values.has('telegram_identity_link_verified:user-1'), false)
  assert.equal(await consumeVerifiedTelegramIdentityLink({
    kv, userId: 'user-1', currentEmail: 'owner@example.com',
  }), false)
})

test('rejects and clears a proof when the account email has changed', async () => {
  const kv = mockKV({ 'telegram_identity_link_verified:user-2': 'old@example.com' })
  assert.equal(await consumeVerifiedTelegramIdentityLink({
    kv, userId: 'user-2', currentEmail: 'new@example.com',
  }), false)
  assert.equal(kv.values.has('telegram_identity_link_verified:user-2'), false)
})

test('rejects missing email and does not allow a replay', async () => {
  const kv = mockKV({ 'telegram_identity_link_verified:user-3': 'owner@example.com' })
  assert.equal(await consumeVerifiedTelegramIdentityLink({
    kv, userId: 'user-3', currentEmail: null,
  }), false)
  assert.equal(await consumeVerifiedTelegramIdentityLink({
    kv, userId: 'user-3', currentEmail: 'owner@example.com',
  }), true)
  assert.equal(await consumeVerifiedTelegramIdentityLink({
    kv, userId: 'user-3', currentEmail: 'owner@example.com',
  }), false)
})
