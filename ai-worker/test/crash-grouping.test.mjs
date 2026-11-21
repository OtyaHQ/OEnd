import assert from 'node:assert/strict'
import test from 'node:test'

import worker from '../src/index.mjs'

function databaseRecorder() {
  const writes = []
  const coreCalls = []
  const db = {
    prepare(sql) {
      assert.match(sql, /INSERT INTO ai_crash_annotations/)
      return {
        bind(...values) {
          return {
            run: async () => {
              writes.push({ sql, values })
              return { success: true }
            },
          }
        },
      }
    },
  }
  const env = {
    DB: db,
    OTYA_AI_CORE_SERVICE_TOKEN: 'test-service-token-that-is-long-enough-123456',
    CORE: {
      async fetch(request) {
        const body = await request.json()
        coreCalls.push({
          pathname: new URL(request.url).pathname,
          method: request.method,
          token: request.headers.get('x-otya-ai-core-token'),
          body,
        })
        return Response.json({ ok: true })
      },
    },
  }
  return { writes, coreCalls, env }
}

async function processCrash(body, env) {
  let acknowledged = false
  let retried = false
  await worker.queue({
    messages: [{
      body: { type: 'process_crash', ...body },
      ack() { acknowledged = true },
      retry() { retried = true },
    }],
  }, env)
  assert.equal(acknowledged, true)
  assert.equal(retried, false)
}

test('identical crashes share a deterministic group and persist through OEnd', async () => {
  const recorder = databaseRecorder()
  const details = {
    errorType: '_AssertionError',
    description: 'audio service failed during startup',
    stackTrace: '#0 AudioServiceConfig (audio_service.dart:3525:11)',
  }

  await processCrash({ crashId: 101, ...details }, recorder.env)
  await processCrash({ crashId: 202, ...details }, recorder.env)

  assert.equal(recorder.coreCalls.length, 2)
  assert.equal(recorder.writes.length, 2)
  assert.equal(recorder.coreCalls[0].pathname, '/internal/ai/crashes/group')
  assert.equal(recorder.coreCalls[0].method, 'POST')
  assert.equal(recorder.coreCalls[0].token, recorder.env.OTYA_AI_CORE_SERVICE_TOKEN)
  assert.equal(recorder.coreCalls[0].body.reportId, 101)
  assert.equal(recorder.coreCalls[1].body.reportId, 202)
  assert.equal(recorder.coreCalls[0].body.group, recorder.coreCalls[1].body.group)
  assert.match(recorder.coreCalls[0].body.group, /^crash-[0-9a-f]{32}$/)
  assert.notEqual(recorder.coreCalls[0].body.group, '101')
})

test('volatile addresses and line numbers do not split a crash group', async () => {
  const recorder = databaseRecorder()

  await processCrash({
    crashId: 303,
    errorType: 'StateError',
    stackTrace: '#0 Player.open (player.dart:171:9) receiver=0xabc123',
  }, recorder.env)
  await processCrash({
    crashId: 404,
    errorType: 'StateError',
    stackTrace: '#0 Player.open (player.dart:193:12) receiver=0xdef456',
  }, recorder.env)

  assert.equal(recorder.coreCalls.length, 2)
  assert.equal(recorder.coreCalls[0].body.group, recorder.coreCalls[1].body.group)
})

test('Vectorize failures retain the deterministic fallback group and persist through OEnd', async () => {
  const recorder = databaseRecorder()
  const env = {
    ...recorder.env,
    AI: { run: async () => { throw new Error('temporary AI failure') } },
    VECTORIZE: { query: async () => { throw new Error('unreachable') } },
  }

  await processCrash({
    crashId: 505,
    errorType: 'FlutterError',
    stackTrace: '#0 Widget.build (widget.dart:44:2)',
  }, env)

  assert.equal(recorder.coreCalls.length, 1)
  assert.match(recorder.coreCalls[0].body.group, /^crash-[0-9a-f]{32}$/)
  assert.equal(recorder.writes.length, 1)
})
