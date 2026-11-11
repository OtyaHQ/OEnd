# Product AI isolation contract

**Owner:** Otya End / Otya AI  
**Applies to:** Opoint, Omy Play and Otya Next  
**Status:** architecture contract; implementation must pass the gates below

## 1. The central design

Share the model gateway and safety/evaluation infrastructure, not the products' data or authority.

Otya AI is the shared model-routing and policy layer. It may route a request to a product-specific agent after the caller's identity and product scope have been verified by the server. The model itself never decides which tenant, company, user or product the caller may access.

Product-specific AI workspaces are separate:

| Workspace | Intended users | Data authority | Default permissions |
|---|---|---|---|
| Otya Next | Verified owners and authorized operators | Otya Control and explicitly approved operational summaries | Read + narrowly approved actions |
| Opoint Assistant | Opoint owner and active staff | Opoint API's company/branch-scoped read models | Read-only |
| Omy Play Guide | Omy Play user | Public product knowledge and user-provided context | Help and explanation only |

A common model provider, AI Gateway or Workers AI binding does not create a shared memory or authorization domain.

## 2. Non-negotiable isolation

Each product must have its own:
- AI conversation namespace and retention policy;
- prompt/system-instruction version;
- tool registry and server-side authorization policy;
- retrieval corpus/vector index, where needed;
- per-product usage quota, rate limit and budget;
- audit events, request correlation and data-retention controls;
- provider credentials where separate account credentials are required.

No default cross-product memory search, embedding lookup, prompt context, user profile join, or AI conversation transfer is permitted. A product switch starts a new scoped context. Any future user-requested export/import must be explicit, logged and reviewed.

Never trust product, company, branch, user, role, scope or tool-permission fields supplied by a mobile/browser client. Resolve the Otya ID token server-side, then resolve product membership from the product-owned API. Bind the verified scope to the entire request and all tool calls.

## 3. Opoint Assistant

Opoint's assistant should help staff understand operational data and complete routine navigation, not act as an autonomous cashier or finance officer.

Allowed first release:
- Explain the Opoint interface and workflows.
- Answer questions from authorized, company/branch-filtered read models.
- Summarize stock alerts, cash-session status, sales summaries and reconciliation exceptions.
- Draft a report or a proposed inventory adjustment for human review.
- Explain provider states using verified server-side status.

Blocked unless a separately reviewed permission and approval workflow is implemented:
- Create or post journal entries.
- Initiate, retry, reverse or settle a payment.
- Perform mobile-money cash-in/cash-out.
- Modify commissions, float, cash balances or reconciliation outcomes.
- Change provider credentials, merchant settings, staff roles or company ownership.
- Execute arbitrary SQL, shell commands, browser actions or generated code against financial systems.

For any future write action, the AI may prepare a typed proposal. A human with the correct Opoint role must review the exact values and submit the operation through the normal Opoint API. The API—not the model—rechecks permission, limits, idempotency and approval requirements.

Do not include full phone numbers, tax identifiers, provider secrets, customer credentials or unneeded personal data in model context. Use masked references and aggregated values wherever possible.

## 4. Omy Play Guide

Omy Play is local-first. Core playback, local search, file scanning, Send, tools and Private/Vault functionality must work without network or AI.

Allowed:
- Explain app features, troubleshooting and supported formats.
- Answer general questions using public Omy Play documentation.
- Help the user interpret information they choose to paste or share.
- Offer optional online assistance that can be disabled.

Forbidden by default:
- Uploading or scanning the local media library for AI.
- Reading Private/Vault files, PINs, biometric state, backup keys or local file paths.
- Building cloud embeddings over a user's music, photos, videos or contacts.
- Using media metadata to profile users or train shared cross-product memory.

Any future media-context feature must be opt-in, granular, reversible and processed with a clearly disclosed scope. Send only the minimum selected metadata/content needed for the request.

## 5. Otya Next and Otya Control

Otya Next remains a private operator-facing assistant. It may inspect health, incidents, build/release status, support and approved operational summaries through dedicated server tools.

Privileged work is approval-gated:
1. Inspect and explain.
2. Prepare a proposed change with exact target and impact.
3. Require fresh authorization/approval for sensitive actions.
4. Execute via a narrow service API.
5. Verify result and write an audit record.

A conversational instruction, agent role, model output or previous approval is not sufficient authority to move money, expose secrets, delete records, modify identity policy, change production routing or deploy production releases.

Public product assistants never inherit Otya Next admin tools or admin conversation context.

## 6. Model routing and cost controls

- Route models through the shared Otya AI policy layer/AI Gateway where supported.
- Use separate model allowlists and cost ceilings for each workspace.
- Make fallback models explicit and preserve the product's safety policy across fallbacks.
- Rate-limit by verified user, product and company where applicable.
- Keep request/response logs metadata-only by default; redact prompts, tokens, customer data and private content.
- Do not silently train on conversations or move user data between providers.
- Store prompt/evaluation versions so regressions can be measured before rollout.

## 7. Failure and offline behavior

If Otya AI, a provider, retrieval or a product backend is unavailable:
- Opoint financial operations continue only through normal Opoint workflows and server controls; AI is never a prerequisite.
- Omy Play playback and all local functionality continue offline.
- Otya Next reports the service as unavailable and must not invent tool results or claim an action succeeded.

A model timeout or malformed response is an unavailable result, not authorization to retry a sensitive operation.

## 8. Required implementation gates

Before enabling a product assistant:
- Server-derived user/product/company/branch authorization tests pass.
- Cross-product and cross-company data-isolation tests prove zero leakage.
- Tool allowlists reject unknown actions and arbitrary SQL/code.
- Prompt-injection tests cover user content, imported documents and tool output.
- Logs and traces redact secrets and sensitive payloads.
- Retention, deletion and export behavior are documented.
- Per-product budgets and rate limits are configured.
- A no-AI/offline path is tested.
- Opoint write proposals require real human authorization; no model can approve its own action.
- Omy Play tests prove no local/Vault media is transmitted without explicit consent.

Do not mark AI enabled solely because a model endpoint responds successfully.
