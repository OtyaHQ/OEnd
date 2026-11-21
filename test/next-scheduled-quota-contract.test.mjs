import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
test('O shared email adapter has a bounded provider deadline', () => {
  const source = read('ai-worker/src/scheduled-entry.mjs')
  assert.match(source, /PROVIDER_TIMEOUT_MS=8000/)
  assert.match(source, /signal:AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/)
  assert.match(source, /OID email service is unavailable/)
})
test('O churn signals use OEnd-owned bounded candidates and deterministic local scoring', () => {
  const source = read('ai-worker/src/scheduled-entry.mjs')
  const internalApi = read('src/lib/ai-internal-api.mjs')
  assert.match(source, /MAX_CHURN_SIGNALS=50/)
  assert.match(source, /coreRequest\(env,'users\/churn-candidates',\{query:\{limit:String\(MAX_CHURN_SIGNALS\)\}\}\)/)
  assert.match(source, /function churnRisk\(days\)/)
  assert.match(source, /env\.KV\.put\('ai:churn:'/)
  assert.match(internalApi, /SELECT user_id,MAX\(last_seen_at\) AS last_seen_at FROM devices/)
  assert.match(internalApi, /GROUP BY user_id/)
  assert.match(internalApi, /LIMIT \?1/)
  const churn = source.match(/async function churnSignals\(env\)[\s\S]*?\n}\nexport default/)?.[0] ?? ''
  assert.ok(churn, 'churnSignals implementation must be present')
  assert.doesNotMatch(churn, /env\.AI\.run|env\.DB\.prepare/)
})
