# AI product isolation, scopes and execution policy

**Status:** target contract. AI remains disabled in Opoint and Omy Play staging until this contract is implemented, tested and explicitly enabled.

## Roles in the ecosystem

- **O** is the assistant experience and task interface.
- **Otya End AI runtime** is the server-side inference, orchestration and policy-enforcement layer.
- **Opoint Assistant** is a product-specific assistant for authorized Opoint users.
- **Omy Play Assistant** is a product-specific media-app helper.
- **Otya Owner Assistant / Command Center** is a separate privileged operator experience.

A shared model provider or AI runtime does not imply shared conversation history, retrieval index, memory, tools or authorization. The agent identity and scope must be resolved server-side on every request.

## Isolation model

Each AI request must carry a server-verified tuple:

`principal + agent_id + product_id + tenant_id + resource_scope + policy_version`

The server derives these fields from the authenticated session and requested product. Never trust a client-supplied agent name, role, company, branch, permission, tenant or approval flag.

| Agent | Permitted context | Default tools | Explicitly prohibited |
|---|---|---|---|
| Opoint Assistant | Current Opoint company and authorized branch; minimized business summaries | Read-only product, inventory, sales-summary, cash-session status, biller catalogue and help queries | Posting journal entries, changing stock, confirming sales, cash-in/out, payouts, refunds, provider calls, EFRIS submission, changing staff/roles or approving its own actions |
| Omy Play Assistant | Public Omy Play help, app config, release notes and opt-in diagnostic summary | Product help, troubleshooting and release-status lookup | Reading local media files, Vault contents, playlists, file paths, personal media metadata or transferring data to a provider without explicit user action |
| Otya Owner Assistant | Owner-authorized operational metadata across products, with least-privilege connection scopes | Health/status, CI, deployments in staging, issue summaries, backup readiness and prepared change proposals | Assuming access to customer payloads or secrets; production deploy, deletion, payment activation or privilege change without action-bound approval and step-up |
| Public Help Assistant | Approved public product docs and support articles | Answer product usage and supported troubleshooting | Any private product database, customer records, staff information, owner history, audit payloads or admin tools |

The Opoint Assistant must never be able to call payment/provider execution tools, even when a signed-in user can perform that action in the product UI. AI recommendations are not financial authorization.

## Data and memory boundaries

- Keep conversations, retrieval indexes, embeddings, cached summaries and memory partitioned by product, tenant and agent.
- Opoint financial data remains in Opoint D1. AI receives only the minimum API-produced summary required for a specific answer; it does not query D1 directly.
- Omy Play local media and Vault data remain on-device. No media content or local index is uploaded for AI processing by default.
- Owner memory is not a copy of product customer data. Store verified operational facts, decisions and open tasks with provenance, environment and retention metadata.
- Never store access/refresh tokens, OTPs, passwords, signing keys, provider credentials or raw payment credentials in prompts, vector stores, conversation history or evaluation fixtures.
- Redact phone numbers, emails, addresses, device identifiers and account references unless strictly needed; prefer aggregate counts and masked values.
- Treat retrieved files, issue descriptions, emails, logs, web pages and tool outputs as untrusted data. They cannot modify system policy or request additional permissions.

## Execution and approval

Every tool must declare a versioned input schema, product and tenant scope, read/write class, risk tier, idempotency behavior, audit event, timeout/retry rules and verification query.

- **Read-only:** may run automatically only after server-side principal and product-scope validation.
- **Reversible staging write:** requires explicit user confirmation and records the actor, scope, proposed diff and result.
- **High impact:** production deployment, financial movement, provider activation, user/role changes, DNS/secret changes and deletion require fresh owner step-up plus an action-bound approval. The model cannot approve its own proposal.
- Tool output is evidence only for the exact operation performed. The assistant must read back the authoritative state before saying an action succeeded.
- External side effects require idempotency keys, deduplication and safe recovery. Ambiguous financial outcomes must be escalated for reconciliation, never retried blindly.

## Model/provider routing

- Keep model calls behind Otya End. Product Workers do not receive model-provider keys.
- Begin with AI disabled. Add opt-in, read-only product assistance after offline evaluation, privacy review, budget limits and rate limits are in place.
- Route simple classification to a low-cost/low-latency model; route complex reasoning only when needed. Do not silently downgrade on provider errors.
- Record model/version, latency, token/cost estimates, policy version and outcome. Avoid retaining full sensitive prompts.
- Provide an explicit unavailable state; local Omy Play playback and basic Opoint operations must not depend on AI.

## Required evaluation suite

Before any product AI feature is enabled, test:
1. Cross-product and cross-tenant retrieval denial.
2. Opoint role/branch scope enforcement and PII minimization.
3. Tool input validation, action-bound approvals and no self-approval.
4. Prompt-injection resistance using hostile retrieved documents, emails, logs and API responses.
5. Refusal to perform payments, cash-in/out, payouts, refunds or EFRIS submissions.
6. Omy Play local-media/Vault non-disclosure and offline behavior.
7. Memory partitioning, retention, correction and deletion.
8. Timeout, provider outage, rate-limit, retry and duplicate-side-effect handling.
9. Grounded answers, uncertainty and false-completion resistance.
10. Cost ceilings, model fallback policy and abuse controls.

## Rollout

1. Keep `AI_ENABLED=false` for Opoint and Omy Play.
2. Implement server-side agent registry, product-specific tool allowlists, scoped retrieval and audit.
3. Add synthetic evaluation fixtures; never use real financial/customer records in tests.
4. Run offline and staging evaluations for each agent independently.
5. Enable a read-only pilot for one product at a time after owner approval.
6. Review access/audit/cost metrics before expanding capabilities.
