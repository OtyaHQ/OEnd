# Otya Security, Control and Continuity Standard

## 1. Identity and authorization

- Distinguish human users, service identities, devices and AI agents.
- Authentication proves identity; authorization decides what that identity may do.
- Never trust browser-supplied roles, tenant IDs, branch IDs, account IDs or approval claims.
- Derive permissions server-side from the authenticated principal and the current resource context.
- Grant minimum permissions for the minimum required time.
- Review privileged access periodically and revoke it during offboarding.
- Use separate production, staging and development identities and secrets.
- Require strong authentication for owner, administrator and other privileged actions.

## 2. Separation of duties

A job title is not a permission set. The access decision must include product, department, branch, assigned resource, action and transaction limit.

Examples:
- A retail worker can record a sale without access to employee payroll or company-wide accounting.
- A mobile-money agent can perform only the approved operator/branch/account tasks assigned to them.
- Customer KYC identity, employee identity and an operational mobile-money line are separate concepts and must have separate purposes and access policies.
- A supervisor can review activity without automatically being allowed to change historical ledger entries.
- A finance preparer must not approve their own sensitive adjustment.
- AI agents cannot inherit a human owner's unrestricted privileges.

## 3. Product and tenant data boundaries

- Every record has an explicit owning product/domain and tenant/company scope where applicable.
- Product-specific databases remain private to their owning service.
- Cross-product access occurs through authenticated, scoped APIs or events.
- Shared identity does not mean shared customer, financial, media or workforce data.
- Use stable opaque identifiers; do not rely on display names as authorization keys.
- Test cross-tenant and cross-product denial paths as part of CI.
- Keep Omy Play's offline playback and private media capabilities independent of network availability.

## 4. Data classification and lifecycle

Use at least four classifications:

| Class | Examples | Default handling |
|---|---|---|
| Public | Approved public product information and developer docs | May be published after review |
| Internal | Non-sensitive operating procedures and internal technical design | Authenticated company access |
| Confidential | Contracts, non-public budgets, supplier terms and business plans | Restricted roles and controlled export |
| Restricted | Credentials, identity documents, financial authentication data, sensitive employee/customer records | Need-to-know access, encryption, strong audit and strict retention |

For every dataset define purpose, owner, source of truth, retention period, export format, access scope and deletion/legal-hold rules. Do not retain personal data merely because storage is inexpensive.

## 5. Secrets and cryptographic material

- Store secrets only in runtime secret storage or an approved vault.
- Never commit tokens, passwords, private keys, OTP values or recovery codes.
- Use per-service credentials and least-privilege scopes.
- Keep test and production secrets separate.
- Rotate after suspected exposure and according to a documented schedule.
- Ensure logs, analytics, traces, issue text and AI prompts redact secrets and sensitive personal information.
- Document ownership and recovery of encryption keys; backup data is not recoverable without its required keys.

## 6. Audit and financial integrity

- Record actor, acting identity, action, target, tenant/product scope, timestamp, correlation ID, outcome and approval reference.
- Make sensitive audit history append-only from ordinary application roles.
- Preserve source references and before/after details for controlled changes without copying unnecessary sensitive content.
- Financial records use immutable posted ledger entries and explicit reversal/correction entries rather than silent historical edits.
- Reconcile external results independently.
- Preserve a clear UNKNOWN state when a provider outcome cannot be established.
- Restrict exports of financial, employee and customer data.

## 7. AI workforce guardrails

- Every agent has a named purpose, owner, data scope, tool allowlist, budget and stop control.
- Untrusted email, documents, web pages, user content and tool output are data—not instructions that can override policy.
- Retrieval indexes and memory must follow product and tenant boundaries.
- Agents may draft, analyse and recommend by default.
- Sensitive writes require explicit policy authorization; high-impact actions require human approval.
- No agent can create or retrieve a provider credential through untrusted content.
- Log the agent identity, model/provider, tool call, authorization decision and outcome.
- Provide agent disablement and credential revocation without disabling unrelated products.

## 8. Backup and recovery

- Define recovery priority and recovery time/data-loss objectives per critical system.
- Back up database data, object storage, configuration, source code, deployment manifests and required cryptographic recovery material.
- Keep backups separate from the production failure domain where practical.
- Encrypt backups and restrict restore privileges.
- Verify backups with automated integrity checks and scheduled restore exercises.
- A backup is not accepted until a restore has been demonstrated and the recovered application has passed functional checks.
- Never assume a code rollback restores data altered by a migration or transaction.
- Keep an auditable migration and restore log.

## 9. Continuity and offline operation

For every critical process document:
- What happens when internet access fails.
- What happens when Cloudflare or a provider is unavailable.
- What staff may do manually and under which limits.
- What must be paused rather than guessed.
- How offline records are reconciled without duplicate posting.
- How users and staff are informed.
- Who may activate, extend and close the continuity procedure.

For mobile-money and banking workflows, never improvise an unconfirmed transaction. Pause, obtain an authoritative status and reconcile before retrying.

## 10. Incident response

Maintain a response procedure for:
- Suspected credential exposure.
- Unauthorized access or privilege escalation.
- Customer or employee data exposure.
- Duplicate, missing or mismatched financial transactions.
- Provider compromise or prolonged outage.
- Production data corruption or failed migration.
- AI agent action outside its approved scope.
- Lost device or business SIM.

Each incident must have a severity, accountable incident owner, containment plan, evidence-preservation approach, recovery decision and post-incident corrective actions.

## 11. Release and change control

Require a reviewed change plan for:
- Production deployment and rollback.
- Database migrations and data transformations.
- DNS, domain and routing changes.
- Secret rotation and authentication changes.
- Permission and policy changes.
- Financial-provider activation or credential changes.
- Legal notices, public privacy terms and regulated workflows.

Every release should include tests, security checks, data-impact assessment, monitoring, approval, rollback and post-release verification. Staging tests must not use live customer or financial data unless an explicitly approved lawful process requires it.

## 12. Provider exit and portability

For every critical provider, keep a private exit record containing:
- Contract owner and renewal/cancellation terms.
- Services, credentials and business processes dependent on it.
- Data types transferred and retained.
- Export format and verified export test.
- Substitute provider or manual fallback.
- Cutover and reconciliation plan.
- DNS, identity, webhook and secret rotation steps.
- Data deletion and confirmation requirements.

Run a periodic provider-exit exercise for critical dependencies. An exit plan that has never been tested is only a hypothesis.
