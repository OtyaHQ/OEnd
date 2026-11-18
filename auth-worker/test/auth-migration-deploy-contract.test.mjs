import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wrangler = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')
const workflow = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8')

test('the Auth Worker registers its checked-in D1 migrations directory', () => {
  assert.match(wrangler, /database_name\s*=\s*"otya-auth-db"[\s\S]*?migrations_dir\s*=\s*"migrations"/)
})

test('the authorized Auth release applies pending remote D1 migrations before deploying code', () => {
  const start = workflow.indexOf('  deploy-auth:')
  const end = workflow.indexOf('  deploy-next:', start)
  assert.ok(start >= 0 && end > start, 'Auth deployment job must exist')
  const job = workflow.slice(start, end)
  const repair = job.indexOf('bash scripts/repair-remote-schema.sh')
  const list = job.indexOf('npx wrangler d1 migrations list otya-auth-db --remote')
  const apply = job.indexOf('npx wrangler d1 migrations apply otya-auth-db --remote')
  const deploy = job.indexOf('npx wrangler deploy')
  assert.ok(repair >= 0, 'the existing non-destructive schema compatibility check must remain')
  assert.ok(list > repair, 'migration status must be inspected after compatibility checks')
  assert.ok(apply > list, 'pending versioned migrations must be applied after listing')
  assert.ok(deploy > apply, 'Worker code must not deploy before its schema migration')
})
