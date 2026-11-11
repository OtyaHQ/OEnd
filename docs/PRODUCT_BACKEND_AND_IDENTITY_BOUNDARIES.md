# Product backend boundaries and identity contract

**Status:** target architecture and staging migration contract. This document does not authorize production cutover, deletion, or credential rotation.

## Product ownership

Each product owns its operational data and release lifecycle. A shared runtime is not permission to share product databases.

| Product | API / Worker | Database | Object storage | Firebase project | Android ID |
|---|---|---|---|---|---|
| Opoint | `opoint-api` | `opoint-staging-db` in staging | `opoint-private-documents` | `opoint-otya-prod` | `com.otya.opoint` |
| Omy Play | `omy-play-api` | `omy-play-staging-db` in staging | `omy-play-staging-assets` | `omyplay-otya-prod` | `com.otya.omyplay` |

The table records the current staging/product direction. Resource IDs, routes and Firebase identifiers must be verified in the target environment before every deploy. Do not reuse a Firebase service account, D1 database, R2 bucket, Queue, signing key or application identifier across products.

### Opoint

Opoint owns retail, inventory, customer/supplier records, branch/staff membership, cash operations, mobile-money agency records, provider intents, the double-entry ledger, audit events, EFRIS metadata and reconciliation. All monetary amounts are integer UGX. The Opoint API enforces company and branch scope server-side.

Financial provider adapters remain separate: MTN MoMo, Airtel Money, Quickteller Business and InterSwitch are distinct contracts. No provider execution or real-money operation is enabled in staging. Unknown outcomes stay `UNKNOWN` until independently reconciled.

### Omy Play

Omy Play owns app configuration, theme catalogues, release metadata, device registrations, crash/feedback/ratings records, notifications and Together session signalling. Playback, scanning, playlists, private media and Vault are local-first. They must continue to work when the API, identity service or AI is unavailable.

The Omy Play backend must not store media files, Vault contents or the user's local media index by default. R2 is for explicitly published product assets/releases only.

## Identity: Otya ID

Otya ID is the shared identity authority. Product APIs consume a verified identity subject through a private service binding and then apply their own product-specific authorization.

- Authentication and authorization are separate. A valid Otya ID session does not automatically grant an Opoint company role or access to Omy Play private features.
- Opoint staff roles, company membership and branch scope remain in Opoint's database.
- Omy Play account features receive only the identity subject and the minimum profile fields needed.
- The browser/app never chooses a trusted user ID, role, company, branch or approval result.
- Tokens are short-lived; refresh rotation, revocation, rate limiting, OTP single-use and audit are server-side requirements.

### Sign-in and OTP policy

The intended sign-in experience is OTP-based using **email** and, when the user explicitly chooses it, **Telegram as a delivery channel only**.

Telegram is not an identity provider or primary sign-in method:
- No Telegram Login Widget, Telegram OIDC login, Telegram Mini App auto-login or Telegram-sourced identity assertion.
- A Telegram message may deliver a one-time code to an already verified/linked destination. The code, expiry, attempt limit and single-use check are owned by Otya ID.
- Telegram delivery must not create a new account, link a Telegram identity, verify a phone number automatically or elevate permissions.
- Email OTP remains available as the independent recovery/sign-in channel.
- If a delivery provider is unavailable, fail clearly and allow a permitted alternate channel; never weaken verification.

The existing `otya-auth` Worker and its deployed routes are compatibility infrastructure until the Otya ID staging contract is fully tested. Do not delete Telegram-related modules, change production route wiring, rotate JWT secrets or migrate account records as part of a documentation-only change. A staged replacement must prove registration, OTP issue/verify, refresh, logout/revocation, recovery, rate limits, lockouts, session invalidation and service-to-service verification before cutover.

## Legacy retirement policy

Legacy code is not dead merely because a replacement is planned. Retire a dependency only after all callers are identified and replaced, tests pass, data/configuration are reconciled, a restorable backup exists, and the rollback window is defined.

In particular:
- Opoint's Supabase Auth / Prisma dashboard path is still referenced by active login and staff-management routes. Keep it until the Otya ID session exchange and Cloudflare API-backed dashboard pass end-to-end tests.
- Existing Opoint legacy Workers and D1 databases are rollback references; keep them isolated and read-only until the replacement is accepted.
- Omy Play's former package ID and Firebase registration must not be mixed with the new `com.otya.omyplay` identity. Package changes require matching Gradle, manifest, Kotlin paths, Firebase config, OAuth and release tests.
- Preserve backups, DNS, GitHub Actions secrets and provider credentials. Do not delete them to make the resource list look cleaner.

## Release gates

A backend is not production-ready solely because its schema or smoke test passes. Each product must pass:
1. Schema migration ledger, object counts, triggers/indexes, foreign-key checks and restore rehearsal.
2. Authentication, authorization, product isolation, rate-limit, input-size and abuse tests.
3. Idempotency, concurrency, audit, retry and failure-mode tests for every write path.
4. Integration contract tests with provider sandboxes; signed webhook verification and reconciliation.
5. Monitoring, alerting, backup retention, restore and incident runbooks.
6. Android/web integration tests against the correct isolated staging API.
7. Legal/provider approvals and owner sign-off before enabling production money movement.

## Current verified staging baseline (2026-11-11)

- Opoint D1: 44 application tables, 19 indexes, 9 triggers and 1 view; three schema migration records; foreign-key check returned no violations. No company, staff, inventory, sales, payments, agency operations or audit rows.
- Omy Play D1: 13 application tables, 13 indexes; one schema migration record; foreign-key check returned no violations. Four default themes and one default app-config row; no devices, crash reports, downloads, feedback, ratings, releases or notifications.
- Staging Workers are bound to their matching product D1 resources and are separate.
- Product staging configs keep AI disabled; Opoint payment/provider execution remains disabled.
- Both product Workers still rely on the legacy `otya-auth` service binding pending the Otya ID migration.

These checks describe staging at the timestamp above, not production certification.
