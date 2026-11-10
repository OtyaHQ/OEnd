import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('OtyaPoint gateway only accepts HttpOnly Otya account cookies and private service bindings', () => {
  const route = read('../src/app/api/otya-point/[...path]/route.ts')
  const config = read('../wrangler.toml')
  assert.match(route, /__Secure-otya_access/)
  assert.match(route, /__Secure-otya_refresh/)
  assert.match(route, /OTYAPOINT_API/)
  assert.match(route, /Authorization: `Bearer \$\{token\}`/)
  assert.match(route, /isAllowedOtyaPointProxyRequest/)
  assert.match(route, /type RefreshResult = \{ accessToken: string; refreshToken\?: string \}/)
  assert.match(route, /if \(tokens\.refreshToken\) response\.cookies\.set\(REFRESH_COOKIE/)
  assert.doesNotMatch(route, /export const (HEAD|DELETE)/)
  assert.match(route, /export const GET = forward/)
  assert.match(route, /export const POST = forward/)
  assert.match(route, /export const PATCH = forward/)
  assert.match(route, /Cache-Control.*private, no-store/)
  assert.match(config, /binding = "OTYAPOINT_API"\s+service = "otyapoint-api"/)
  assert.doesNotMatch(route, /NEXT_PUBLIC|SUPABASE|localStorage/)
})
