import test from 'node:test'
import assert from 'node:assert/strict'
import { isOwnerTelegramCallback } from '../src/lib/telegram-admin-callback.mjs'

test('admin MFA callback is recognized without a non-existent telegram_verified field', () => {
  assert.equal(isOwnerTelegramCallback({ ok: true, admin_mfa: true, user: { id: 'otya-user' } }), true)
})

test('normal Telegram responses cannot enter the owner callback route', () => {
  assert.equal(isOwnerTelegramCallback({ ok: true, telegram_verified: true }), false)
  assert.equal(isOwnerTelegramCallback({ ok: true, telegram_login: true }), false)
  assert.equal(isOwnerTelegramCallback(null), false)
})
