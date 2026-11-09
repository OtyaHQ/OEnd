import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Next routes every runtime surface through the named AI Gateway wrapper', () => {
  const wrangler = read('ai-worker/wrangler.toml')
  const entry = read('ai-worker/src/scheduled-entry.mjs')

  assert.match(wrangler, /^name\s*=\s*"otya-next"$/m)
  assert.match(wrangler, /^main\s*=\s*"src\/scheduled-entry\.mjs"$/m)
  assert.match(wrangler, /^AI_GATEWAY_ID\s*=\s*"otya-next-gateway"$/m)

  assert.match(entry, /function withAiGateway\(env\)/)
  assert.match(entry, /gatewayId=String\(env\.AI_GATEWAY_ID/)
  assert.match(entry, /gateway:\{\.\.\.priorGateway,id:gatewayId,skipCache:true\}/)

  assert.match(entry, /const runtimeEnv=withAiGateway\(env\)/)
  assert.match(entry, /aiWorker\.fetch\(request,runtimeEnv,ctx\)/)
  assert.match(entry, /aiWorker\.queue\(batch,withAiGateway\(env\),ctx\)/)
  assert.match(entry, /weekly\(runtimeEnv,event\.scheduledTime\)/)
  assert.match(entry, /daily\(runtimeEnv,event\.scheduledTime\)/)
  assert.match(entry, /urgent\(runtimeEnv,event\.scheduledTime\)/)
})
