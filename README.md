# OEnd

**Shared backend, identity integration and service infrastructure for the Otya ecosystem.**

OEnd provides shared server-side capabilities through narrow, authenticated service contracts. It is not a shared product database: OPoint and Omy Play each own their operational data, backend API, release workflow and observability boundary.

## Product and service boundaries

- **OPoint** — retail, inventory, cash, agency operations, payments, ledger and reconciliation. Its business records remain in the OPoint data plane.
- **Omy Play** — local-first media application with its own connected-services API, D1, R2, Firebase project and release pipeline. Playback remains available offline.
- **O** — private owner AI application. It receives only explicitly authorized operational summaries and acts through reviewed OEnd/product APIs.
- **Otya ID** — shared identity, email OTP, session security and optional Telegram bot OTP delivery. Telegram Login/OIDC is not a sign-in method.
- **Otya Control** — private administration and operational visibility, separate from consumer APIs.
- **OHub** — public developer and partner documentation. Private infrastructure, credentials and operator runbooks do not belong there.

## OEnd responsibilities

- Otya ID integration and identity service contracts.
- Product-specific service authentication and authorization primitives.
- Transactional email through Resend.
- Shared webhook, event-delivery and notification transport where appropriate.
- Operational monitoring, audit correlation and recovery support.
- AI model routing, policy enforcement and the private O tool gateway.
- Narrow service-to-service integrations without cross-product direct database access.

## Isolation rules

- OPoint and Omy Play do not share D1 databases, private files, queues, Firebase service credentials or operational keys.
- Product APIs resolve user and product permissions server-side. A valid Otya ID session does not automatically grant product membership.
- O does not query product databases directly. It calls typed, scoped APIs and receives only data needed for the approved task.
- Opoint financial actions remain disabled until provider, compliance, security and reconciliation gates pass.
- Omy Play local playback, local file access and Private/Vault remain on-device and work without OEnd or AI.
- FCM/email notifications are delivery hints; the owning product API remains authoritative.

## Current runtime compatibility

Some deployed Workers and routes still carry older internal script names. Those are compatibility identifiers, not customer-facing product names. Migrate them through separately named staging resources, verified service bindings, smoke tests and an approved cutover. Do not delete or rename an active production resource solely to improve its label.

| Runtime responsibility | Product owner |
|---|---|
| Shared identity and OTP | Otya ID |
| Shared routing, email and service integration | OEnd |
| Private owner assistant runtime | O |
| Business operations API and database | OPoint |
| Media connected-services API and database | Omy Play |
| Public developer content | OHub |

## Engineering and release rules

- GitHub is the source of truth for code and review.
- Cloudflare is the runtime and data platform.
- Resend is the transactional email provider.
- Secrets remain in Cloudflare Secrets Store or the relevant provider's secure secret manager.
- Financial writes must be idempotent, atomic, auditable and reconciled.
- Unknown provider outcomes remain UNKNOWN until independently confirmed.
- AI may inspect, explain and draft; privileged execution requires server-side authorization and explicit approval.
- Production migrations, deployment, DNS changes, secret rotation, payment-provider activation and irreversible deletion require a reviewed recovery plan and owner authorization.

A successful CI build or staging deployment is not a production release.

## Public information

Use [otya.site](https://otya.site) as the current ecosystem domain. Product documentation belongs on OHub; private operational material belongs in restricted repositories and approved internal workspaces.

Report vulnerabilities privately through [SECURITY.md](SECURITY.md). This repository contains proprietary OEnd backend software and infrastructure; use is governed by [LICENSE](LICENSE).

---

**OEnd · Otya**
