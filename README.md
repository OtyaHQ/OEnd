# Otya End

**Otya End** is the shared backend and integration layer for the Otya ecosystem.

It provides reusable server-side identity, product-scoped APIs, email delivery, AI orchestration, audit and operational capabilities. It is one shared backend—not a reason to merge product databases, user memories or permissions.

## Product boundaries

- **Otya** — the parent ecosystem brand.
- **Opoint** — retail, inventory, cash and regulated financial-service operations. Its business records and ledger stay in its own database.
- **Omy Play** — local-first media. Core playback and private local media remain on-device and work offline.
- **O** — the ecosystem AI and automation layer. It coordinates approved capabilities; it does not receive unrestricted access to every product.
- **Otya ID** — shared identity, sessions, recovery and OTP delivery. Each product separately authorizes its users and roles.
- **Otya Control** — private administration, configuration, security and operations.
- **Otya End** — shared backend services and integrations.
- **OtyaHub** — public developer and partner information.

Legacy repository slugs, Worker names, API paths and database identifiers may remain where needed for compatibility. Do not rename or delete a deployed resource solely to make its name match the product label.

## Shared responsibilities

- Otya ID identity verification, account security, session and OTP services.
- Server-side product-scoped authorization and service contracts.
- Transactional email through the existing Resend integration.
- Product-owned API and data services through private service bindings.
- Otya AI model routing and policy enforcement.
- Otya Control operator intelligence, support, incidents and approved actions.
- Secure recovery, audit trails, monitoring and operational readiness.

## Separation rules

- Opoint and Omy Play own separate Worker runtimes, D1 databases, R2 buckets, queues, Firebase projects, secrets, AI workspaces and release pipelines.
- A shared Otya ID identity is not a product permission. Each API must resolve the product's membership, role and scope on every protected request.
- AI model infrastructure may be shared, but product prompts, tools, conversation history, memory, retrieval indexes, logs and quotas must be isolated by product and user.
- Opoint financial records are never exposed to Omy Play. Omy Play local media and Private/Vault contents are never uploaded to Otya AI by default.
- No browser-supplied role, provider secret, or trusted identity claim.
- Financial operations must be idempotent, atomic, auditable and reconciled.
- Unknown provider outcomes remain UNKNOWN until independently confirmed.
- Email and internal service routes require server-side credentials and bounded permissions.
- A product outage must not stop another product's core offline/local functionality.

## Identity and login

Otya ID is the identity authority. The supported direction is email OTP and, where the user links it, Telegram bot-delivered OTP. Telegram OAuth, Telegram Login Widget and Telegram Mini App identity are not primary login methods. Telegram remains a message-delivery/linked-account channel only.

## AI ownership

Otya AI provides policy-controlled model routing and common evaluation/observability. It does not get direct unrestricted access to product databases. Product-specific agents receive typed, least-privilege tools from their own backend.

- **Otya Next** remains a private owner/operator assistant with explicit approval for privileged actions.
- **Opoint Assistant** is a company-scoped, read-only operational copilot by default. It cannot post journal entries, initiate payments, change provider settings or approve its own recommendations.
- **Omy Play Guide** is optional and local-first. It cannot inspect or upload the user's media library, Private/Vault files or local identifiers without explicit consent.

See [Product AI isolation](docs/PRODUCT_AI_ISOLATION.md) for the implementation contract.

## Engineering and safety principles

- Never commit API tokens, service-account keys, provider credentials, signing keys, PINs or production data.
- Keep secrets in the relevant Cloudflare secret store or protected GitHub environment.
- Keep public product status distinct from branch-only code, deployed staging and production.
- Preserve backups and rollback paths before migrations or cutovers.
- Use synthetic data and provider sandboxes until compliance, provider approval and release gates pass.
