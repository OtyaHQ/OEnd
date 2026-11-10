import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('both direct and queued FCM sends select an Android channel', () => {
  const direct = read('src/lib/fcm.ts')
  const queue = read('src/queue-worker.mjs')

  assert.match(direct, /channel_id: 'otya_announcements'/)
  assert.match(queue, /channelId = messageType === 'update'/)
  assert.match(queue, /'otya_updates'/)
  assert.match(queue, /'otya_announcements'/)
  assert.match(queue, /collapse_key/)
  assert.match(queue, /ttl:/)
})

test('admin push links stay on official HTTPS hosts', () => {
  const route = read('src/app/api/push/route.ts')

  assert.match(route, /url\.protocol !== 'https:'/)
  assert.match(route, /host\.endsWith\('\.petersmartlink\.com'\)/)
  assert.match(route, /official Otya HTTPS host/)
})
