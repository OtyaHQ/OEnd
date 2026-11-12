import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const staging = read('wrangler.otya-id-staging.toml')
const production = read('wrangler.toml')
const migration = read('migrations-staging/0001_otyid_staging_baseline.sql')
const workflow = read('../.github/workflows/deploy-otyid-staging.yml')

test('Otya ID staging is private and uses isolated resources', () => {
  assert.match(staging, /^name = "otya-id-staging"$/m)
  assert.match(staging, /^workers_dev = false$/m)
  assert.match(staging, /^keep_vars = false$/m)
  assert.match(staging, /database_name = "otya-id-staging-db"/)
  assert.match(staging, /database_id = "575e42b8-fa87-4161-a0df-e7bba50b3df8"/)
  assert.match(staging, /id = "9bcd68a2cc014b68bdebac9ef6183314"/)
  assert.match(staging, /migrations_dir = "migrations-staging"/)
  assert.match(staging, /required = \["AUTH_JWT_SECRET", "RESEND_API_KEY"\]/)
  assert.doesNotMatch(staging, /routes\s*=|TELEGRAM_BOT_TOKEN|TELEGRAM_LOGIN_CLIENT/)
})

test('production Auth config does not include the isolated staging D1 or migration folder', () => {
  assert.match(production, /name = "otya-auth"/)
  assert.match(production, /database_name = "otya-auth-db"/)
  assert.doesNotMatch(production, /otya-id-staging|migrations-staging/)
})

test('staging baseline is idempotent schema-only SQL without user or token rows', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS users/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS email_otp_challenges/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS linked_identities/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_security_events/)
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_ci/)
  assert.doesNotMatch(migration, /^\s*INSERT\s+INTO\s+/im)
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+(users|email_otp_challenges|linked_identities)/i)
})

test('staging deployment is manual, branch-bound and requires its own secrets', () => {
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /github\.ref == 'refs\/heads\/identity-ai-separation'/)
  assert.match(workflow, /DEPLOY-STAGING/)
  assert.match(workflow, /CLOUDFLARE_API_TOKEN_STAGING/)
  assert.match(workflow, /AUTH_JWT_SECRET_STAGING/)
  assert.match(workflow, /RESEND_API_KEY_STAGING/)
  assert.match(workflow, /--config wrangler\.otya-id-staging\.toml/)
  assert.match(workflow, /d1 migrations apply otya-id-staging-db --remote/)
  assert.match(workflow, /--secrets-file "\$SECRETS_FILE"/)
  assert.doesNotMatch(workflow, /secrets\.AUTH_JWT_SECRET\s*\}\}/)
  assert.doesNotMatch(workflow, /secrets\.RESEND_API_KEY\s*\}\}/)
  assert.doesNotMatch(workflow, /wrangler deploy --config wrangler\.toml/)
})
