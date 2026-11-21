import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../src/index.mjs'

test('O identifies itself using its permanent product name', async () => {
  const response = await worker.fetch(new Request('https://o/health'), {})
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, service: 'O', ai: false })
})

test('O does not expose the retired public chat API', async () => {
  const response = await worker.fetch(new Request('https://o/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'hello', guest_id: 'public-guest' }),
  }), {})
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'Not found' })
})
