# Otya Change Coordination and Release Sequencing

## Purpose

Otya products share some identity, deployment, API and migration contracts. Concurrent pull requests can be individually plausible while producing an incompatible combined state. This standard prevents parallel work from creating conflicting migration histories, identity regressions or accidental production coupling.

## 1. One authoritative migration sequence per database

- A database has one declared owner and one canonical migration directory.
- Migration version numbers and filenames are unique within that database history.
- Two pull requests must not independently introduce different SQL under the same migration number or filename.
- If parallel changes are needed, integrate them into one reviewed sequence with explicit dependency order and monotonic migration identifiers.
- Migrations are append-only after they have been applied to a shared environment. Never rewrite an applied migration to make branches fit.
- Every migration must have a clean-database test, upgrade-from-current test, integrity checks and rollback/recovery notes.
- Schema changes are tested against disposable/local databases and isolated staging first.
- Production data is never moved or remapped implicitly. Row ownership, NULL/default treatment and record mapping require evidence and an approved migration plan.

## 2. Identity and authorization changes are integrated as one release unit

- Changes touching authentication, sessions, token claims, OTP, account linking, staff identity or service bindings must be reviewed together when their files or contracts overlap.
- Keep authentication (who the principal is) distinct from authorization (what the principal may do).
- Phone, email, messaging and social accounts are contact or delivery channels unless an approved identity protocol explicitly establishes otherwise.
- A staging product must not call production identity by convenience. Staging identity must have its own service, database, KV/queue bindings and staging-only credentials.
- Do not switch a service binding until the target service is deployed, its settings are verified, and login, expiry, revocation, recovery, suspended-account and failure-path tests pass.
- Any change to sign-in routes or account-linking behavior requires integrated regression tests and a tested account recovery path.

## 3. Provider and financial integrations use a separate safety gate

- A sandbox integration is not evidence of live-provider authorization.
- Provider activation requires the current contract, product/country capability, credentials in server-side secret storage, webhook verification, idempotency, status inquiry and reconciliation.
- A timeout or ambiguous response is UNKNOWN until independently reconciled.
- Automatic failover for financial operations is disabled unless duplicate prevention and provider semantics have passed end-to-end tests.
- Credentials, merchant identifiers, test accounts and provider payloads do not belong in public documentation.

## 4. Required pull request metadata

Every infrastructure, identity, schema or integration pull request must state:

- Owning product/domain and environment.
- Database/schema or API contract affected.
- Dependencies on other open changes.
- Whether a migration is additive and how it is tested.
- Data classification and data movement, if any.
- Secrets or provider settings required (names only; never values).
- CI and security evidence.
- Deploy target, release authority, rollback and recovery plan.
- Post-deploy smoke tests and the person accountable for sign-off.

## 5. Merge sequencing

1. Merge foundational contracts and data-ownership decisions first.
2. Integrate overlapping identity and security changes before deploying dependent product Workers.
3. Deploy shared staging dependencies before staging products that bind to them.
4. Run the complete affected test suite on the integrated result, not only on each isolated branch.
5. Deploy one environment/component at a time and verify actual runtime settings after deployment.
6. Promote production only after staging acceptance, data backup/restore confidence, explicit owner approval and a rollback plan.

Do not merge or deploy a pull request only because its branch CI is green. Green CI proves the tested branch revision, not compatibility with every other open branch or live Cloudflare state.

## 6. Emergency pause and recovery

The release owner must be able to pause a deployment, disable an adapter or revoke an agent/service credential without taking unrelated products offline. Preserve evidence and follow the incident procedure when a change causes unexpected identity, data, finance or privacy behavior.
