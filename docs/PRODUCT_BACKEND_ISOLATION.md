# Product backend isolation policy

**Status:** Architecture target for the Otya ecosystem. This document does not itself change any deployed Worker, database, route, DNS record, secret, or account.

## Product ownership

| Product or capability | Runtime/data owner | Boundary |
|---|---|---|
| Otya ID | Shared identity service | Identity, sessions, verification and account security only |
| Opoint | Opoint API and Opoint D1 | Retail, inventory, cash, agency operations, receipts, ledger and reconciliation |
| Omy Play | Omy Play API and Omy Play D1 | App configuration, themes, device registration, diagnostics, feedback, notifications and Together control-plane metadata |
| Otya owner AI (O) | Private owner agent backed by Otya End | Owner-authorized orchestration and review; no product data ownership |
| Otya Control | Private administration surface | Configuration and operational visibility, separated from consumer APIs |
| OtyaHub | Public developer surface | Public contracts and guides only; never private credentials or internal runbooks |

## Isolation rules

1. Each product owns a distinct D1 database, R2 bucket/prefix policy, Worker service identity, queue namespace, cache namespace, Firebase project, app identity, release workflow and observability context.
2. Shared identity does not imply shared data access. Product APIs verify the Otya ID token, audience, issuer, expiry and session status, then resolve product-specific membership and permissions.
3. Product APIs never read another product's D1 directly. Cross-product actions require an explicitly designed, authenticated service contract with a narrow payload.
4. Product AI context, memory, retrieval indexes, feedback and conversation history are segregated by product and principal. The owner agent receives access only through policy-approved tools.
5. Firebase is a supporting mobile service, not a financial or product-record source of truth. FCM is a notification transport; the owning product API remains authoritative.
6. No provider secret, signing key, service-account key, access token or private deployment credential belongs in mobile bundles or public Git repositories.

## Opoint contract

Opoint owns business records and financial integrity. Monetary values are integer UGX. Posted journals are balanced, immutable and auditable. Retail cash operations, mobile-money agency operations and third-party bill payments are distinct workflows. External provider calls use intents, idempotency, an outbox, independently verified callbacks and reconciliation. A timeout is UNKNOWN, not success. Provider adapters must remain separate (for example MTN MoMo, Airtel Money, Quickteller Business, InterSwitch and EFRIS).

Until provider approval, licensing/contract validation and operational controls are independently verified, provider write paths remain disabled and tests use synthetic data or provider sandboxes only.

## Omy Play contract

Omy Play remains offline-first. Local playback, library scanning, search and local media tools must not depend on Cloudflare, Firebase or AI availability. Backend responsibilities are optional connected services: app configuration, themes, device/FCM registration, crash/feedback intake, release metadata and the minimal signaling/control plane required for Together.

The backend must not ingest raw local-media libraries or Private files. Diagnostics are minimized and scrubbed before persistence. The Android application ID and Firebase app registration must match exactly.

## Shared services

Otya End may centralize operational primitives (identity integration, email delivery, notification dispatch, observability, inference routing, policy evaluation and service-to-service authentication). It must not become a shared catch-all product database. Shared services should expose narrow APIs, use explicit service identities, and retain per-product isolation.

## Cleanup and retirement procedure

A resource is not "dead" merely because a newer resource exists. Before retiring any old Worker, database, bucket, queue, KV namespace, secret binding, route or branch:

1. Inventory active bindings, routes, consumers, producers, cron triggers, scheduled workflows, webhooks and release downloads.
2. Identify the owning product and all code/config references.
3. Export and checksum any retained records or objects; perform a restore test where data is involved.
4. Migrate consumers and validate the replacement in staging.
5. Observe the replacement through representative device and API tests.
6. Obtain human approval for production cutover and irreversible deletion.
7. Keep a documented rollback window and then remove only the proven-unused resource.

Do not delete a shared service or legacy release alias just to make names look tidy. Compatibility aliases can remain while public clients migrate.

## Release gates

A staging Worker is not production. Before production:
- source must be reviewed and versioned in GitHub;
- unit, schema, contract, security and real-device integration tests pass;
- database migrations are replayable and verified;
- access-control and product-isolation tests pass;
- backup/restore evidence and rollback plan exist;
- observability and incident ownership are configured;
- provider/legal/compliance approvals are complete where relevant; and
- the owner explicitly approves production cutover.

