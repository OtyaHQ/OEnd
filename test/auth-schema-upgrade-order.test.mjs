import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../auth-worker/src/db.ts', import.meta.url), 'utf8')

test('preserved auth schemas upgrade required columns before dependent indexes', () => {
  assert.ok(source.includes("const USERS_TABLE_SQL = `"))
  assert.ok(source.includes("google_id: 'TEXT'"))
  assert.ok(source.includes("password_hash: 'TEXT'"))
  assert.ok(source.includes("is_verified: 'INTEGER DEFAULT 0'"))

  const ensureStart = source.indexOf('export async function ensureSchema')
  const ensureBody = source.slice(ensureStart, ensureStart + 700)
  const createBase = ensureBody.indexOf('await db.exec(USERS_TABLE_SQL)')
  const upgradeColumns = ensureBody.indexOf('await ensureUserColumns(db)')
  const createIndexes = ensureBody.indexOf('await db.exec(SCHEMA_SQL)')

  assert.ok(createBase >= 0)
  assert.ok(upgradeColumns > createBase)
  assert.ok(createIndexes > upgradeColumns)
})


test('OID deployment repairs only its configured D1 and adds optional username fields safely', () => {
  const repair = readFileSync(new URL('../auth-worker/scripts/repair-remote-schema.sh', import.meta.url), 'utf8')
  const deploy = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
  const schema = readFileSync(new URL('../auth-worker/src/db.ts', import.meta.url), 'utf8')

  assert.match(repair, /OTYA_AUTH_DB_NAME:-otya-id-db/)
  assert.match(repair, /CONFIG_DB_NAME.*!=.*DB_NAME/s)
  assert.match(repair, /ensure_column users username "TEXT"/)
  assert.match(repair, /ensure_column users username_changed_at "TEXT"/)
  assert.match(repair, /CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_ci/)
  assert.match(deploy, /OTYA_AUTH_DB_NAME: otya-id-db/)
  assert.match(schema, /username_changed_at: 'TEXT'/)
  assert.match(schema, /idx_users_username_ci/)
})
