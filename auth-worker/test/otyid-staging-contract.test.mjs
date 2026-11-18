import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readAuth = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const staging = readAuth("wrangler.otya-id-staging.toml");
const production = readAuth("wrangler.toml");
const baseline = readAuth("migrations-staging/0001_otyid_staging_baseline.sql");
const loginMigration = readAuth("migrations-staging/0002_email_login_challenges.sql");
const workflow = readFileSync(new URL("../../.github/workflows/deploy-otyid-staging.yml", import.meta.url), "utf8");

test("Otya ID staging is private and uses isolated Cloudflare resources", () => {
  assert.match(staging, /^name = "otya-id-staging"$/m);
  assert.match(staging, /^main = "src\/production-entrypoint-secure.ts"$/m);
  assert.match(staging, /^workers_dev = false$/m);
  assert.match(staging, /database_name = "otya-id-staging-db"/);
  assert.match(staging, /database_id = "575e42b8-fa87-4161-a0df-e7bba50b3df8"/);
  assert.match(staging, /id = "9bcd68a2cc014b68bdebac9ef6183314"/);
  assert.match(staging, /migrations_dir = "migrations-staging"/);
  assert.match(staging, /required = \["AUTH_JWT_SECRET", "RESEND_API_KEY"\]/);
  assert.doesNotMatch(staging, /routes\s*=|workers_dev = true/);
  assert.doesNotMatch(staging, /otya-auth-db|b05595f6-260a-4720-acca-4f8b13f5c43e/);
});

test("production Auth remains a separate Worker and database", () => {
  assert.match(production, /^name = "otya-auth"$/m);
  assert.match(production, /database_name\s*=\s*"otya-auth-db"/);
  assert.doesNotMatch(production, /otya-id-staging|migrations-staging/);
});

test("the staging-only baseline creates schema, not copied user or session rows", () => {
  for (const table of ["users", "account_two_factor", "auth_security_events", "email_otp_challenges", "linked_identities", "user_products"]) {
    assert.match(baseline, new RegExp("CREATE TABLE IF NOT EXISTS " + table));
  }
  assert.doesNotMatch(baseline, /^\s*INSERT\s+INTO\s+/im);
});

test("staging has a separate migration for the new OtyaPoint email-login challenge table", () => {
  assert.match(loginMigration, /CREATE TABLE IF NOT EXISTS auth_email_login_challenges/);
  assert.match(loginMigration, /code_digest TEXT NOT NULL/);
  assert.match(loginMigration, /FOREIGN KEY \(user_id\) REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.doesNotMatch(loginMigration, /^\s*INSERT\s+INTO\s+/im);
});

test("staging deployment requires manual approval and dedicated secrets", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /DEPLOY-STAGING/);
  for (const secret of ["CLOUDFLARE_API_TOKEN_STAGING", "AUTH_JWT_SECRET_STAGING", "RESEND_API_KEY_STAGING"]) {
    assert.match(workflow, new RegExp(secret));
  }
  assert.match(workflow, /d1 migrations apply otya-id-staging-db --remote/);
  assert.match(workflow, /--config wrangler\.otya-id-staging\.toml --secrets-file/);
  assert.doesNotMatch(workflow, /secrets\.AUTH_JWT_SECRET\s*\}\}/);
  assert.doesNotMatch(workflow, /secrets\.RESEND_API_KEY\s*\}\}/);
});

test("database migration is applied before staging Worker deployment", () => {
  const migration = workflow.indexOf("d1 migrations apply otya-id-staging-db");
  const deploy = workflow.indexOf("wrangler deploy --config wrangler.otya-id-staging.toml --secrets-file");
  assert.ok(migration >= 0 && deploy > migration);
});
