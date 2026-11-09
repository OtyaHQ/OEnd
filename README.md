# Otya End

**Otya End** is the shared backend and integration layer for **Otya OS** and its connected products.

It provides reusable server-side identity, product-scoped APIs, integrations, delivery services, audit and operational capabilities. It is one shared backend—not a reason to merge every product's private data into one database.

## Product boundaries

- **Otya OS** — the unified platform and shared experience.
- **Otya End** — shared backend and integration layer.
- **OtyaPoint** — retail, inventory and mobile-money agency operations. Its shop records and financial ledgers remain isolated in its own data store.
- **Otya Media** — local-first music and video. Core playback must remain available without the backend.
- **OtyaHub** — public developer and partner documentation. Private infrastructure and credentials do not belong there.
- **Leo / Otya Next** — the private owner-facing AI coordinator and intelligence experience. Privileged execution stays server-side and approval-gated.

Legacy repository slugs, Worker names, API paths, and database identifiers may remain where required for compatibility. Do not rename or delete a deployed resource solely to make its name match the product label.

## Shared responsibilities

- Otya identity, session and account-security services.
- Server-side authorization and product-scoped service contracts.
- Transactional email through the existing Resend integration.
- Otya Media release delivery and supporting APIs.
- Otya Next owner intelligence, support, incidents and approved actions.
- Secure recovery, audit trails, monitoring and operational readiness.
- Private service-to-service integration between ecosystem products.

## Engineering and safety principles

- One shared identity, with product-specific authorization and data ownership.
- No browser-supplied roles, provider secrets, or trusted identity claims.
- No cross-product direct writes to another product's database.
- Financial operations must be idempotent, atomic, auditable and reconciled.
- Unknown provider outcomes remain UNKNOWN until independently confirmed.
- Email and internal service routes require server-side secrets and bounded permissions.
- AI can prepare and recommend actions; privileged execution requires explicit authorization.
- Production migrations, deployments, DNS changes, secret rotation and payment-provider activation require explicit authorization and a reviewed recovery plan.
- Preserve user data, local-first guarantees and existing compatibility contracts.

## Current backend layout

| Runtime | Responsibility |
|---|---|
| `otya-auth` | Shared identity, account security and Resend transport |
| `otya-core` | Shared product APIs, release/notification transport and backend routing |
| `otya-next` | Owner intelligence, scheduled operations and AI workflows |
| OtyaPoint API source | Product-scoped shop and agency operations, isolated from shared account data |

These names describe separate runtime responsibilities; they are not duplicate backends. Do not add another Worker or database for a capability already owned by one of these services without a concrete isolation or scaling reason.

## Production and compatibility

GitHub is the source of truth for code and review. Cloudflare is the runtime and data platform. Resend is the shared transactional email provider. Provider-specific financial integrations remain disabled until their exact Uganda contracts, credential custody, callback verification, reconciliation and compliance requirements are approved.

Merging source code is not a production deployment. The production deployment workflow remains explicitly approval-gated. Never apply a D1 migration to a remote database just because it exists in the repository.

## Public information

- Otya: https://petersmartlink.com
- Documentation: https://petersmartlink.com/docs
- OtyaHub: https://github.com/PeterSmartLink/OtyaHub

Keep customer-facing product documentation on the official public surfaces. Do not publish secrets, private endpoints, internal infrastructure inventories, customer records, recovery material, signing keys or administrative procedures here.

## Security and licensing

Report vulnerabilities privately through [SECURITY.md](SECURITY.md). This repository contains proprietary Otya backend software and infrastructure; use is governed by [LICENSE](LICENSE).

---

**Otya End · Otya OS**
