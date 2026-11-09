import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/lib/ai.ts', import.meta.url), 'utf8')

test('churn analysis uses activity, not legacy Pro subscription state', () => {
  assert.doesNotMatch(source, /pro_expiry|proExpired|Pro subscription expired/i)
  assert.match(source, /Days since last seen:/)
  assert.match(source, /Total play count:/)
})
