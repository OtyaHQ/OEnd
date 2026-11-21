# Otya MCP implementation readiness

**Status:** engineering audit complete; implementation not yet enabled  
**Canonical service owner:** Otya End (OEnd)  
**Identity authority:** OID  
**Platform owner:** Otya OS  
**Public developer documentation:** OHub  
**Private owner assistant:** O  
**Review date:** 2026-11-21

## Decision

Build the Otya MCP server as a capability-limited interface inside Otya End. Do not create a second backend, a second identity provider, a separate public AI product, or a new Worker solely to host MCP.

Canonical names are Otya OS, Otya End (OEnd), OID, O, Opoint, Omy Play and OHub. The MCP server is an OEnd capability, not a new product brand.

## Repository evidence

The current OEnd developer-platform specification already defines OTYA MCP as an optional AI/agent interface over explicitly published developer tools and scopes, separate from private Admin AI tools. It places MCP after app registration, OAuth/scopes, API contracts, audit logs, webhooks and SDK foundations in the rollout order.

The current OEnd runtime is `oend`, configured in `wrangler.toml`, with the API host routed to the OEnd Worker. It has service bindings to `oid`, `o`, `opoint` and `omy-play`. OID is already the shared identity service.

The repository search and source inspection did not locate an implemented MCP transport, JSON-RPC `initialize`, `tools/list`, `tools/call` handler, MCP endpoint, or dedicated MCP OAuth resource-server implementation. The developer-platform document is a product/architecture specification, not proof of a working MCP service.

## Existing security boundaries to preserve

- OID remains the identity authority; MCP must not invent a parallel account system.
- OID's existing ordinary account access JWT must not automatically be accepted as an MCP token. MCP needs a token whose issuer, audience/resource, expiry, client identity and granted scopes are validated for the MCP resource.
- Public Developer Apps and their OAuth grants must remain separate from O Admin/Command Center authorization.
- O must remain owner-only. No private owner tools, support inbox, Cloudflare/GitHub administrative actions, infrastructure secrets or owner memory may appear in the public MCP tool catalogue.
- Opoint data remains tenant/company/branch scoped and must only be exposed through approved Opoint APIs. MCP must never query Opoint D1 directly.
- Omy Play remains local-first. MCP cannot expose local media, Private/Vault files or playback history.
- No financial writes, payment initiation, ledger posting, refunds, credential changes, destructive operations or production deployments in the initial public tool set.
- Every tool must enforce authorization server-side, use bounded schemas, rate limits, request IDs, audit events and deterministic error handling.

## Readiness gaps before a public MCP endpoint

1. **Developer App registry:** no verified implementation was found for app registration, environment separation, redirect URI allow-listing, credential rotation/revocation or app ownership.
2. **OAuth authorization server:** the existing OID user login/JWT contract is not, by itself, evidence of the MCP OAuth authorization-code + PKCE flow, resource indicators/audience binding, protected-resource metadata, consent, scope grants or refresh-token lifecycle for third-party clients.
3. **Public API contract:** the developer-platform document specifies API gateway requirements, but the inspected files do not establish that the initial versioned, scope-enforced public API surface is implemented.
4. **Audit and quota enforcement:** MCP must reuse the same authoritative app/user authorization, audit and rate-limit policy as its equivalent API operations. These controls need concrete verified implementations.
5. **Tool catalogue:** there is no verified published-tool registry with per-tool scope, audience, risk class, schema validation and versioning.
6. **Protocol implementation:** no verified Streamable HTTP MCP endpoint or protocol conformance tests were found.

## Proposed implementation sequence

### Phase A — foundations in OEnd/OID
- Inventory the actual production D1 schema, Worker bindings, auth routes and public API routes before designing migrations.
- Define the Developer App and OAuth grant data model with explicit development/production isolation.
- Extend OID only where needed to issue and revoke short-lived, MCP-resource-specific grants; do not weaken or repurpose existing login tokens.
- Implement OAuth authorization-code with PKCE, exact redirect URI matching, consent, revocation, refresh rotation and resource/audience binding.
- Implement protected-resource and authorization-server discovery metadata required by the selected current MCP protocol revision.
- Add scope enforcement, quotas, rate limiting and immutable/minimised audit events.

### Phase B — versioned public API
- Publish only a small, explicitly approved set of read-only user-authorized API operations.
- Ensure each operation enforces tenant/product scope in its owning service.
- Add contract, abuse, authorization, privacy and integration tests before MCP wraps any operation.

### Phase C — MCP facade in OEnd
- Add a single HTTPS Streamable HTTP endpoint under the OEnd API host after confirming the exact public route and compatibility policy.
- Implement protocol initialization/version negotiation and tool discovery/calls against a fixed allow-listed registry.
- Map each tool to an existing public API operation; do not call internal databases or private Admin AI tools directly.
- Validate Origin, request size, content type, protocol headers/version and bearer token on every request.
- Return safe, structured errors and never include secrets or internal infrastructure details.
- Add protocol conformance, negative authorization, cross-tenant isolation, replay, rate-limit and audit tests.

### Phase D — controlled rollout
- Start with development-only app credentials and read-only tools.
- Test with a dedicated developer client, then an external MCP client.
- Keep production access disabled until OAuth, privacy, security and conformance gates pass.
- Publish public integration instructions through OHub only after the endpoint is verified.
- Do not deploy, migrate production databases, alter DNS, create production credentials or enable financial operations as part of the initial implementation.

## Initial candidate read-only tool groups

These are candidates, not approved or implemented tools:

- Otya public product and documentation discovery.
- Authenticated user's own basic profile, only with an explicit profile scope.
- User-authorized notification status/metadata, only after the notification API and consent model are verified.
- Read-only public service status.
- Opoint read-only company reports only after tenant and branch isolation is proven and separately consented.

Do not publish a generic `execute`, `admin`, `database_query`, `cloudflare_manage`, `github_write`, `send_email`, or `make_payment` tool.

## Acceptance criteria

The MCP service is not complete until:

- a supported MCP client discovers and connects using the documented OAuth flow;
- tokens are resource/audience-bound, short-lived, revocable and scope-limited;
- unauthenticated, expired, wrong-audience and insufficient-scope requests fail closed;
- no public client can enumerate or invoke O Admin tools;
- tenant isolation is proven by automated tests;
- every tool has a narrow schema, documented data classification, rate limit and audit event;
- protocol conformance and abuse tests pass in CI;
- development deployment and endpoint behavior are independently verified;
- OHub documentation points to a real, tested endpoint.

## Operational rule

A merged PR, green CI run, or configured Worker is not proof of a production MCP deployment. Report implementation, CI validation, development deployment and production verification as separate states.
