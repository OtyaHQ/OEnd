import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const router = read('src/production-router.mjs')
const workerConfig = read('wrangler.toml')
const gate = read('src/components/OtyaSpaceGate.tsx')
const chrome = read('src/components/OtyaSpaceChrome.tsx')
const dashboard = read('src/components/SpaceOtyaPointDashboard.tsx')

test('Otya Core reaches OtyaPoint only through the private Worker service binding', () => {
  assert.match(workerConfig, /binding = "OTYAPOINT"\s+service = "otyapoint-api"/)
  assert.match(router, /async function proxyOtyaPointApi\(request, url, env\)/)
  assert.match(router, /return env\.OTYAPOINT\.fetch\(new Request\(upstreamUrl\.toString\(\), init\)\)/)
  assert.doesNotMatch(workerConfig, /pattern\s*=\s*"api\.point\.otya\.site"/)
})

test('OtyaPoint bridge accepts only the host-only Otya Space session', () => {
  assert.match(router, /function cookieValue\(request, name\)/)
  assert.match(router, /cookieValue\(request, '__Secure-otya_access'\)/)
  assert.match(router, /function isCanonicalSpaceHost\(hostname, env\)/)
  assert.match(router, /!legacy\.has\(host\)/)
  assert.match(router, /if \(!accessToken\) return json\(\{ error: 'unauthenticated' \}, 401\)/)
})

test('OtyaPoint browser writes are same-origin and do not forward browser cookies', () => {
  assert.match(router, /origin !== url\.origin/)
  assert.match(router, /fetchSite === 'cross-site'/)
  assert.match(router, /const headers = new Headers\(\{\s*Authorization: 'Bearer ' \+ accessToken/)
  assert.doesNotMatch(router, /headers\.set\(['"]cookie['"]/i)
})

test('the staff navigation is shown only after OtyaPoint verifies an active staff identity', () => {
  assert.match(gate, /fetch\('\/api\/point\/api\/me'/)
  assert.match(gate, /setBusinessAccess\(pointAccess\?\.ok === true\)/)
  assert.match(chrome, /businessAccess = false/)
  assert.match(chrome, /OtyaPoint operations/)
  assert.match(chrome, /const groups = businessAccess[\\s\\S]*?\\[\\.\\.\\.GROUPS/)
})

test('owner bootstrap requires verified Otya identity and an allowlisted account', () => {
  assert.match(router, /async function bootstrapOtyaPointOwner\(request, url, env\)/)
  assert.match(router, /env\.AUTH\.fetch/)
  assert.match(router, /env\.ADMIN_EMAILS/)
  assert.match(router, /env\.OTYAPOINT_BOOTSTRAP_SECRET/)
  assert.match(router, /x-otyapoint-bootstrap-key/)
  assert.match(router, /owner_bootstrap_not_authorized/)
  assert.match(dashboard, /mutate<[^>]+>\('\\/bootstrap-owner'/)
  assert.match(dashboard, /branchCode: 'MBR001'/)
  assert.match(dashboard, /district: 'Lwengo District'/)
  assert.match(dashboard, /townCouncil: 'Mbirizi Town Council'/)
  assert.match(dashboard, /locationLabel: 'Old Market, Mbirizi'/)
  assert.doesNotMatch(dashboard, /OTYAPOINT_BOOTSTRAP_SECRET|x-otyapoint-bootstrap-key/)
})

test('the OtyaPoint dashboard consumes branch-scoped API data and hides unauthorized work areas', () => {
  assert.match(dashboard, /fetch\('\/api\/point' \+ path/)
  assert.match(dashboard, /X-Otya-Branch-Id/)
  assert.match(dashboard, /areas\.has\('RETAIL'\)/)
  assert.match(dashboard, /areas\.has\('MOBILE_MONEY'\)/)
  assert.match(dashboard, /No provider request or money movement is initiated/)
})
