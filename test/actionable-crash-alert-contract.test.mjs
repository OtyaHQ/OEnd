import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const scheduled = read('ai-worker/src/scheduled-entry.mjs')
const internalApi = read('src/lib/ai-internal-api.mjs')
test('O receives grouped crash diagnostics from the private OEnd API', () => {
  assert.match(scheduled, /coreRequest\(env,'crashes',\{query:\{window:'-1 hour',limit:'6'\}\}\)/)
  assert.match(scheduled, /const groups=Array\.isArray\(core\.groups\)\?core\.groups:\[\]/)
  assert.match(internalApi, /COUNT\(DISTINCT NULLIF\(device_id,''\)\) AS devices/)
  for (const field of ['sample_description','sample_stack','app_version','version_code']) assert.match(internalApi, new RegExp(field))
})
test('crash alert text redacts personal details and bounds diagnostic samples', () => {
  for (const token of ['[redacted-email]','[redacted-token]','[redacted-jwt]','[redacted-device-path]']) assert.ok(scheduled.includes(token))
  assert.match(scheduled, /crashEmailDetail\(x\.sample_description,320\)/)
  assert.match(scheduled, /crashEmailDetail\(x\.sample_stack,420\)/)
  assert.match(scheduled, /const threshold=Math\.max\(3,Number\(env\.ADMIN_CRASH_ALERT_THRESHOLD\|\|5\)\)/)
  assert.match(scheduled, /const key='ops:crash-alert:'/)
})
