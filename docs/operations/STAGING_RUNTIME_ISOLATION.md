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

- `auth-worker/migrations/20261111_otyid_staging_baseline.sql`
- `ai-worker/migrations/20261111_o_ai_staging_baseline.sql`

No user/account/conversation/memory rows were copied. Existing production `otya-auth-db`, `otya-store-db`, `otyapoint-db`, the restore-verification databases, old production Workers and existing backups were preserved.

## Runtime configurations

- `auth-worker/wrangler.otya-id-staging.toml` defines a private Otya ID staging Worker.
- `ai-worker/wrangler.o-ai-staging.toml` defines a private O staging Worker with its own D1, KV, R2 and Queue.
- Neither staging Worker is publicly routed or deployed until the staged auth flow and secret bindings are verified.
- OPoint and Omy Play staging Worker service bindings still target the old `otya-auth` Worker at the time of this record. They must be switched only after `otya-id-staging` is deployed and smoke-tested.
- The old `otya-next` Worker remains a compatibility runtime. New O development must use `o-ai-staging`; do not connect O to the shared `otya-store-db`.

## Required gates before staging deploy

1. Finish Otya ID OTP-only policy and provider delivery implementation.
2. Set unique staging secrets; do not reuse production JWT, Resend or Telegram provider credentials.
3. Deploy `otya-id-staging` with no public route and verify rate limits, OTP expiry, replay protection and session revocation.
4. Deploy `o-ai-staging`; ensure owner-only access, no public chat, separate memory namespace and no direct product D1 access.
5. Change OPoint and Omy Play staging service bindings to `otya-id-staging`.
6. Verify each product can only access its own data and that failed/missing identity service calls fail closed.
7. Run smoke tests and recovery checks; do not merge or activate production resources until all gates pass.

## Production safety

This record describes staging preparation only. It does not certify either Worker for production, enable live payments, enable account sign-in, or authorize a public release.
