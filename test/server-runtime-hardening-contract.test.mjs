import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('live APK routes enforce active abuse controls and cache latest builds briefly', () => {
  const route = read('src/app/api/omy-play/[...path]/route.ts')
  assert.match(route, /OMY_PLAY_API/)
  assert.match(route, /ALLOWED_PATHS/)
  assert.match(route, /same_origin_required/)
  assert.match(route, /private, no-store/)
  assert.match(route, /X-Content-Type-Options/)
  assert.doesNotMatch(route, /Access-Control-Allow-Origin/)
})

test('production Google audience verification is bounded', () => {
  const source = read('auth-worker/src/production-entrypoint.ts')
  assert.match(source, /GOOGLE_VERIFY_TIMEOUT_MS = 8000/)
  assert.match(source, /signal: AbortSignal\.timeout\(GOOGLE_VERIFY_TIMEOUT_MS\)/)
  assert.match(source, /headers: \{ Accept: 'application\/json' \}/)
})

test('push queue bounds upstream calls and avoids whole-broadcast replay after partial delivery', () => {
  const queue = read('src/queue-worker.mjs')
  assert.match(queue, /UPSTREAM_TIMEOUT_MS = 8000/)
  assert.match(queue, /signal: AbortSignal\.timeout\(UPSTREAM_TIMEOUT_MS\)/)
  assert.match(queue, /sent === 0 && transientFailed > 0/)
  assert.match(queue, /sent > 0 && transientFailed > 0/)
  assert.match(queue, /were not replayed because/)
})

test('production health checks include OEnd identity and O service bindings', () => {
  const entry = read('src/entrypoint.mjs')
  assert.match(entry, /service:\$\{name\}/)
  assert.match(entry, /'oend-identity'/)
  assert.match(entry, /'o'/)
  assert.match(entry, /https:\/\/oend-identity\/auth\/me/)
  assert.match(entry, /https:\/\/o\/health/)
  assert.match(entry, /SERVICE_HEALTH_TIMEOUT_MS = 5000/)
})

test('generic admin release metadata endpoint cannot bypass canonical release workflow', () => {
  const route = read('src/app/api/admin/release/route.ts')
  assert.match(route, /verifyAdminSession/)
  assert.match(route, /Direct release metadata publishing is disabled/)
  assert.match(route, /verified GitHub release workflow/)
  assert.doesNotMatch(route, /INSERT INTO releases/)
  assert.doesNotMatch(route, /AI_QUEUE/)
})


test('Core operational alerts use the single Resend-backed email adapter', () => {
  const legacyCore = read('src/index.js')
  const entry = read('src/entrypoint.mjs')

  assert.match(entry, /withProductionAdapters\(env\)/)
  assert.match(entry, /EMAIL:createResendEmailAdapter\(env\)/)
  assert.match(legacyCore, /Resend email adapter unavailable/)
  assert.doesNotMatch(legacyCore, /env\.RESEND_API_KEY/)
  assert.doesNotMatch(legacyCore, /api\.resend\.com\/emails/)
})


test('Core production deployment requires the Resend operational-email secret', () => {
  const workflow = read('.github/workflows/deploy.yml')
  const coreDeploy = workflow.slice(workflow.indexOf('  deploy-core:'), workflow.indexOf('  verify-production:'))

  assert.match(coreDeploy, /RESEND_API_KEY: \$\{\{ secrets\.RESEND_API_KEY \}\}/)
  assert.match(coreDeploy, /test -n "\$CLOUDFLARE_ACCOUNT_ID" && test -n "\$CLOUDFLARE_API_TOKEN" && test -n "\$RESEND_API_KEY"/)
})
