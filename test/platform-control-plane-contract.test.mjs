import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('production deployment uploads the canonical router as a version without reapplying routes', () => {
  const pkg = JSON.parse(read('package.json'))
  const wrangler = read('wrangler.toml')
  const router = read('src/production-router.mjs')
  const deploy = read('scripts/deploy-core-version.mjs')

  assert.match(pkg.scripts.deploy, /opennextjs-cloudflare build/)
  assert.match(pkg.scripts.deploy, /node scripts\/deploy-core-version\.mjs/)
  assert.match(deploy, /'versions',\s*'upload'/)
  assert.match(deploy, /'src\/production-router\.mjs'/)
  assert.match(deploy, /'versions',\s*'deploy'/)
  assert.match(deploy, /`\$\{versionId\}@100%`/)
  assert.match(deploy, /event\?\.type === 'version-upload'/)
  assert.doesNotMatch(deploy, /triggers',\s*'deploy'/)
  assert.doesNotMatch(pkg.scripts.deploy, /wrangler deploy src\/production-router/)

  assert.match(wrangler, /^main = "src\/production-router\.mjs"$/m)
  assert.match(wrangler, /^workers_dev = false$/m)
  assert.doesNotMatch(wrangler, /custom_domain = true|^routes\\s*=/m)
  assert.match(router, /import openNextWorker from '\.\.\/\.open-next\/worker\.js'/)
  assert.match(router, /headers\.set\('Content-Security-Policy', CANONICAL_CSP\)/)
})

test('canonical browser policy supports Google Identity Services without weakening admin boundaries', () => {
  const router = read('src/production-router.mjs')
  const entrypoint = read('src/entrypoint.mjs')

  assert.match(router, /script-src[^\n]*https:\/\/accounts\.google\.com/)
  assert.match(router, /connect-src[^\n]*https:\/\/accounts\.google\.com/)
  assert.match(router, /frame-src[^\n]*https:\/\/accounts\.google\.com/)
  assert.match(entrypoint, /const ACCESS_COOKIE = '__Secure-otya_access'/)
  assert.match(entrypoint, /const ADMIN_COOKIE = 'otya_admin_session'/)
  assert.match(entrypoint, /hasElevatedAdminSession/)
})

test('Google provider subject is authoritative and conflicting subjects fail closed', () => {
  const db = read('auth-worker/src/db.ts')

  assert.match(db, /const bySubject = await getUserByGoogleId\(db, googleId\)/)
  assert.match(db, /if \(bySubject\) return refreshGoogleProfile/)
  assert.match(db, /GOOGLE_IDENTITY_CONFLICT/)
  assert.match(db, /existing\.google_id && existing\.google_id !== googleId/)
  assert.match(db, /const racedSubject = await getUserByGoogleId\(db, googleId\)/)
})
