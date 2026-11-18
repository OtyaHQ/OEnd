# Otya Independence Programme

**Status:** Architecture proposal — public-safe engineering specification  
**Home:** Otya End  
**Scope:** Current and future Otya products, departments and company operations

## Purpose

Otya should own the software, business logic, data models, operating procedures, product experience and decision controls that make the company work. External providers should supply replaceable infrastructure, regulated networks, physical connectivity or specialist capabilities—not become the only place where Otya's operating knowledge or business state exists.

This programme establishes a practical build-versus-buy policy and a shared architecture for OtyaPoint, Omy Play, OtyaHub, Otya OS, Otya End, the owner-facing O application and future ventures.

This document is a public-safe architecture contract. Private financial records, employee records, customer data, provider credentials, recovery codes, private network details and detailed security configurations must remain in approved private storage.

## Outcomes

1. Otya can export and restore its business data in documented formats.
2. Strategic business rules and workflows are implemented and versioned in Otya-owned code.
3. External providers are accessed through adapters with explicit capability contracts.
4. Products keep their own data ownership and authorization boundaries.
5. Provider outages degrade only the affected capability where possible.
6. Critical operations have tested recovery procedures and accountable human owners.
7. AI agents operate with bounded roles, scoped tools and traceable approvals.
8. New systems reuse approved Otya capabilities instead of creating duplicate identity, finance, CRM, messaging or automation platforms.

## Architecture

The architecture has six layers:

| Layer | Responsibility | Examples |
|---|---|---|
| Corporate governance | Entity records, ownership, policy, authority and decisions | Governance, legal register, approvals |
| Company operating environment | Navigation, control centre, objectives and workflows | Otya OS |
| Shared technical foundation | Identity, API contracts, integration, audit, observability and common runtime services | Otya End |
| Domain systems | Business capabilities with clear data ownership | Finance, commerce, workforce, customer, procurement |
| Product applications | User-facing products and product-specific workflows | OtyaPoint, Omy Play, OtyaHub |
| External infrastructure and rails | Infrastructure Otya cannot reasonably or legally replace | Telecoms, banks, official APIs, hosting, app stores |

These layers describe ownership boundaries; they do not require a microservice per feature. Start with clear modules and contracts. Split a module into a separate service only for a concrete security, scaling, availability or independent-release reason.

## Shared foundation and product boundaries

Otya End may provide reusable identity, API gateway patterns, audit envelopes, provider adapters, notification transport, monitoring and deployment contracts. Shared infrastructure does not mean shared unrestricted data.

- Identity can be shared; product authorization must be server-derived and product-scoped.
- Product records and business ledgers remain owned by their product/domain.
- No product may directly read or write another product's database.
- Inter-product communication uses authenticated, versioned APIs or events.
- Omy Play's core playback remains local-first and must not depend on Otya End being reachable.
- OtyaPoint's retail and mobile-money agency records remain product-owned and separately permissioned.
- Public developer material belongs in OtyaHub; confidential operating records do not.

Existing product-isolation and AI-isolation work must be reviewed and merged as the prerequisite contracts, rather than duplicated here.

## Company capability domains

The full catalogue is in [CAPABILITY_CATALOG.md](./CAPABILITY_CATALOG.md). Its top-level domains are:

- Corporate governance, strategy and portfolio management.
- Finance, treasury, tax, accounting, audit and asset control.
- Retail, commerce, stock, purchasing, suppliers and distribution.
- Mobile-money agency operations and provider reconciliation.
- People, workforce, payroll, learning and AI workforce management.
- Customer relationship, marketing, support and communications.
- Product lifecycle, engineering, developer experience and release management.
- Security, privacy, legal, risk, compliance and quality.
- Data governance, analytics, research and business intelligence.
- Facilities, physical equipment, continuity and disaster recovery.

## Build-versus-buy policy

**Build and own:** domain logic, data models, authorization policies, business workflows, approval rules, customer experience, reporting definitions, audit records, internal automation and integration contracts.

**Use open source where appropriate:** commodity software that can be safely operated, patched, backed up and migrated by the team. Assess maintenance and security burden before adopting it.

**Buy or integrate:** telecom delivery, banking/payment rails, regulated operator services, government interfaces, app distribution, commodity compute and specialist infrastructure where self-operation is not practical or lawful.

**Never assume replaceability:** every provider dependency must have an owner, purpose, data map, credential owner, cost/risk record, exit path and recovery plan.

Do not self-host a commodity system merely to claim independence. Self-host only when the operational cost, security and support burden is justified.

## Provider independence

Every external integration must follow [PROVIDER_ADAPTER_STANDARD.md](./PROVIDER_ADAPTER_STANDARD.md).

Required rules:
- Provider-specific details stay inside the adapter.
- Business services call a provider-neutral contract.
- Secrets stay in runtime secret storage, never source control or logs.
- Requests use idempotency where the provider supports it.
- Webhooks are authenticated, replay-protected and idempotently processed.
- Unknown transaction outcomes remain UNKNOWN until independently reconciled.
- Automatic failover is prohibited for money movement unless duplicate prevention and provider semantics are proven.
- A provider can be disabled or replaced without rewriting the owning business domain.

## Security, continuity and control

All systems must follow [SECURITY_AND_CONTINUITY.md](./SECURITY_AND_CONTINUITY.md). The minimum controls include least privilege, separation of duties, product/tenant isolation, append-only audit events, tested backups, incident response, data export and reviewed release gates.

Sensitive actions—including financial posting, payment initiation, credential rotation, permission escalation, legal publication, production migrations and production deployment—must use explicit authorization and an auditable approval path.

AI may research, prepare, summarise, classify and recommend. It may only execute privileged actions through narrowly scoped tools and an approved authorization policy. AI output alone is not evidence of a transaction, legal status or successful delivery.

## Implementation sequence

### Phase 0 — Establish the truth
- Inventory repositories, default branches, open PRs, runtime resources, databases, buckets, queues, domains and provider connections.
- Map each resource to one owner, product, environment and purpose.
- Verify schemas through read-only SQL instead of relying solely on control-plane counts.
- Identify duplicate, orphaned, staging, backup and restore-verification resources.
- Record what is actually deployed separately from what exists only in source code.

### Phase 1 — Secure the foundation
- Confirm repository visibility and separate public engineering material from private company records.
- Define account, product, tenant, role, permission and service identity contracts.
- Complete product-data and AI-tool isolation.
- Standardise audit events, secrets management and release approvals.
- Validate backup and restore procedures.

### Phase 2 — Operate the existing business
- Complete OtyaPoint company operations: inventory, sales, cash, float, staff, supplier and reconciliation workflows.
- Keep mobile-money agent operations distinct from customer KYC and staff identity permissions.
- Add dependable finance controls and immutable ledger/reconciliation records.
- Build workforce and owner control surfaces on top of these contracts.

### Phase 3 — Remove avoidable provider lock-in
- Implement provider-neutral adapters for communications, AI models, storage and approved financial integrations.
- Add provider health checks, cost tracking, delivery receipts and failure handling.
- Implement export formats and provider exit drills.
- Retain fallback providers only where contracts, geographic support and duplicate safety are verified.

### Phase 4 — Company-wide automation
- Introduce the workflow engine and AI workforce registry.
- Add departmental agents with isolated tools, data scopes, quotas and approvals.
- Add business intelligence from authoritative source records.
- Keep human accountability for regulated, legal and high-impact decisions.

### Phase 5 — Resilience and expansion
- Test disaster recovery, offline workflows and infrastructure migration.
- Add branches and subsidiaries only after entity, permissions, accounting and reporting boundaries are designed.
- Consider externalising internal capabilities as services only after legal, licensing, security and support requirements are met.

## Completion criteria

A capability is complete only when it has:
- A named business owner and technical owner.
- Documented scope, data owner and authorization rules.
- Tested happy path, failure path and security boundary.
- Monitoring, audit trail and support procedure.
- Backup/export and recovery method where data is stored.
- Provider exit or manual continuity procedure when an external dependency exists.
- Cost and operational burden understood.
- Explicit release approval and rollback plan when production is affected.

## Existing engineering work to reconcile

This programme must be aligned with existing work; these are review references, not assertions that the PRs are already merged or deployed:

- Otya End PR #278 — product backend isolation.
- Otya End PR #279 — product AI isolation.
- Otya End PR #277 — domain portability and public-service naming.
- Otya End PR #281 — isolated identity and private AI runtime.
- OtyaPoint PR #143 — company operations foundations.
- Otya End PR #267 — Uganda compliance readiness and consent history.
- Otya End PR #297 — passwordless email OTP sign-in.

Before implementation, check each PR's current status and CI results, resolve overlap and preserve established release gates.
