import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createTestHarness } from 'wrangler'

const server = createTestHarness({
  workers: [{ configPath: './auth-worker/wrangler.toml' }],
})

before(async () => {
  await server.listen()
})

after(async () => {
  await server.close()
})

test('auth worker denies JWT verification without credentials', async () => {
  const response = await server.fetch('http://localhost/auth/verify')
  assert.equal(response.status, 401)
  const body = await response.json()
  assert.match(String(body.error ?? ''), /Authorization header required/i)
})

test('admin MFA fails closed before any privileged work', async () => {
  const response = await server.fetch('http://localhost/auth/admin/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  assert.equal(response.status, 403)
  const body = await response.json()
  assert.match(String(body.error ?? ''), /verification is required/i)
})

test('2FA settings require an authenticated Otya account', async () => {
  const response = await server.fetch('http://localhost/auth/2fa/status')
  assert.equal(response.status, 401)
  const body = await response.json()
  assert.match(String(body.error ?? ''), /sign in to otya first/i)
})

test('Telegram primary login is disabled before auth database access', async () => {
  const response = await server.fetch('http://localhost/auth/telegram/start?mode=login', {
    method: 'POST',
  })
  assert.equal(response.status, 410)
  const body = await response.json()
  assert.equal(body.code, 'TELEGRAM_LOGIN_DISABLED')
  assert.match(String(body.error ?? ''), /not an Otya sign-in provider/i)
})
