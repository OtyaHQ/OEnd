import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../src/app/api/omy-play/[...path]/route.ts', import.meta.url), 'utf8')

test('Omy Play same-origin gateway exposes only health, latest metadata and published APK reads', () => {
  assert.match(route, /const ALLOWED_PATHS = new Set\(\['health', 'latest', 'apk\/arm64', 'apk\/arm32'\]\)/)
  assert.match(route, /export async function GET/)
  assert.match(route, /binding\.fetch\(new Request\(target/)
  assert.match(route, /redirect: 'manual'/)
  assert.match(route, /AbortSignal\.timeout\(20000\)/)
  assert.match(route, /same_origin_required/)
  assert.doesNotMatch(route, /export async function POST/)
})
