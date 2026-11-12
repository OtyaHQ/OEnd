# Otya staged runtime isolation and cutover record

Date: 11 November 2026

## Canonical product/runtime names

- OPoint — business/retail application and its own backend/data plane.
- Omy Play — local-first media application and its own backend/data plane.
- O — private owner-AI application and its own backend/data plane.
- OEnd — shared backend and service integration repository.
- Otya ID — shared identity/OTP service hosted by OEnd.
- OHub — public developer/partner documentation.

## Isolated staging resources

| Boundary | Resource | Identifier |
|---|---|---|
| OPoint | D1 | `opoint-staging-db` / `ec080a51-cfc9-4375-8b3c-64667744b466` |
| Omy Play | D1 | `omy-play-staging-db` / `006b1ac1-0e92-4480-b07e-4232724710e8` |
| O | D1 | `o-ai-staging-db` / `50619fbd-098c-4f22-b038-75e7e23ee3c6` |
| Otya ID | D1 | `otya-id-staging-db` / `575e42b8-fa87-4161-a0df-e7bba50b3df8` |
| O | R2 | `o-ai-staging-private` |
| O | KV | `o-ai-staging-session-cache` / `3f3172a64be04655a52d012efdac0648` |
| Otya ID | KV | `otya-id-staging-session-cache` / `9bcd68a2cc014b68bdebac9ef6183314` |
| O | Queue | `o-ai-staging-jobs` and `o-ai-staging-jobs-dlq` |
| Otya ID | Queue | `otya-id-staging-delivery` and `otya-id-staging-delivery-dlq` |

These are isolated staging resources. No production Worker or public route was changed by creating them.

## Schema-only replacement

Two unused/unbound D1 databases were verified before replacement:

- `opoint-core-db`: only Cloudflare's internal `_cf_KV` table; no application tables, no Worker binding and no repository references.
- `otya-next-db`: AI schema only; all conversation, message, memory, approval, task, event, support-audit and owner-action row counts were zero; only one migration marker existed. It had no Worker binding and no repository references.

Those two D1 resources were deleted. Their replacement schemas are version-controlled in:

- `auth-worker/migrations-staging/0001_otyid_staging_baseline.sql`
- `ai-worker/migrations/20261111_o_ai_staging_baseline.sql`

No user/account/conversation/memory rows were copied. Existing production `otya-auth-db`, `otya-store-db`, `otyapoint-db`, the restore-verification databases, old production Workers and existing backups were preserved.

## Runtime configurations

- `auth-worker/wrangler.otya-id-staging.toml` defines a private Otya ID staging Worker.
- `ai-worker/wrangler.o-ai-staging.toml` defines a private O staging Worker with its own D1, KV, R2 and Queue.
- Neither staging Worker is publicly routed or deployed until the staged auth flow and secret bindings are verified.
- The OPoint and Omy Play Wrangler staging manifests now target `otya-id-staging`; however, the deployed Cloudflare Worker settings still target the production `otya-auth` service until the two product staging Workers are redeployed after Auth staging exists.
- The old `otya-next` Worker remains a compatibility runtime. New O development must use `o-ai-staging`; do not connect O to the shared `otya-store-db`.

## Required gates before staging deploy

1. Finish Otya ID OTP-only policy and provider delivery implementation.
2. Add these GitHub Actions secrets: in **OEnd**, `CLOUDFLARE_ACCOUNT_ID`, a dedicated least-privilege `CLOUDFLARE_API_TOKEN_STAGING`, a fresh random `AUTH_JWT_SECRET_STAGING` (at least 32 characters), and a sending-only `RESEND_API_KEY_STAGING` restricted to the verified `otya.site` sender domain; in **OPoint** and **Omy_Play**, `CLOUDFLARE_ACCOUNT_ID` and the dedicated `CLOUDFLARE_API_TOKEN_STAGING`. Never reuse the production Cloudflare API token, JWT secret or Resend key.
3. Manually run `.github/workflows/deploy-otyid-staging.yml` from `identity-ai-separation` and enter the exact confirmation `DEPLOY-STAGING`. The workflow runs tests, applies only the idempotent staging baseline migration and deploys the Worker with `workers_dev=false` and no public route. Then verify rate limits, OTP expiry, replay protection and session revocation. After the Otya ID Worker has been deployed and smoke-tested, manually run `.github/workflows/deploy-opoint-staging.yml` in OPoint from `opoint-rebuild-foundation` and `.github/workflows/deploy-omy-play-staging.yml` in Omy_Play from `omy-play-backend-foundation`, each with the same exact confirmation. Both workflows check for the staged Auth Worker before changing product bindings and verify the resulting service binding.
4. Deploy `o-ai-staging`; ensure owner-only access, no public chat, separate memory namespace and no direct product D1 access.
5. Change OPoint and Omy Play staging service bindings to `otya-id-staging`.
6. Redeploy OPoint and Omy Play staging from their isolated manifests; verify each product can only access its own data and that failed/missing identity service calls fail closed.
7. Run smoke tests and recovery checks; do not merge or activate production resources until all gates pass.

## Production safety

This record describes staging preparation only. The Auth staging Worker and product staging redeploy workflows are prepared in their draft branches. No staging deployment has been run. They remain gated until the required dedicated GitHub secrets exist, the PR branches are accepted into the default branch, and a maintainer manually dispatches each workflow. It does not certify either Worker for production, enable live payments, enable account sign-in, or authorize a public release.
