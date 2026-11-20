# Otya Provider Adapter Standard

## Purpose

Business domains must depend on Otya-owned contracts rather than vendor SDKs, vendor response formats or vendor-specific assumptions. A provider adapter is the only layer that translates between an external service and an Otya capability.

This standard applies to communications, AI models, email, identity verification, storage, analytics, banking/payment integrations and other external APIs.

## Required adapter structure

Each adapter must define:

1. Provider identity and supported environment.
2. Capabilities supported and capabilities not supported.
3. Configuration schema with secret references only.
4. Typed request and normalized response contract.
5. Error mapping and retry classification.
6. Idempotency and duplicate-handling semantics.
7. Webhook verification and event normalization.
8. Health and readiness checks that do not expose secrets.
9. Usage, latency, failure and cost metrics where available.
10. Data location, retention, subprocessors and exit/export notes.
11. Sandbox and live-mode separation.
12. Contract tests and provider-change test cases.

## Provider-neutral capability contract

A domain should ask Otya for an outcome, not call a vendor directly. Conceptual operations include:

- Send a message.
- Verify an authentication challenge.
- Generate speech or transcribe audio.
- Invoke an AI model.
- Store or retrieve an object.
- Initiate a payment through a separately approved financial integration.
- Inquire about transaction status.
- Verify and normalize a provider webhook.

The exact contract is owned by the Otya domain. Do not create unused endpoints merely to mirror a vendor's product catalogue.

## Normalized result model

Every adapter must distinguish:

- **SUCCEEDED** — provider outcome is independently confirmed.
- **ACCEPTED** — provider accepted the request but final delivery/settlement is pending.
- **PENDING** — operation is still being processed.
- **UNKNOWN** — timeout or transport failure means the external outcome cannot be determined.
- **FAILED** — provider definitively rejected or failed the operation.
- **REVERSED** — the provider reports a completed reversal/refund according to the domain contract.
- **UNSUPPORTED** — selected provider does not support the requested capability or destination.
- **DISABLED** — the adapter is intentionally unavailable in this environment.

Do not convert UNKNOWN into FAILED. Do not present ACCEPTED as delivered, paid, settled or approved.

## Idempotency and retries

- Generate an Otya-owned idempotency key at the domain boundary.
- Pass it through to a provider when supported and store its correlation.
- Persist operation intent before external side effects.
- Retry only transient failures and only when the operation's duplicate semantics are safe.
- Use bounded exponential backoff with jitter, maximum attempts and dead-letter handling.
- Never retry a financial request with a new key merely because the client timed out.
- Reconcile UNKNOWN outcomes using provider inquiry, statement or callback evidence before making a second attempt.
- Design event consumers for at-least-once delivery and duplicate events.

## Webhook security

- Verify signatures using the provider's documented scheme and the raw request body where required.
- Enforce timestamp tolerance and replay protection when supported.
- Validate the event's expected account, environment and resource correlation.
- Persist a minimal, immutable receipt before asynchronous processing.
- Deduplicate with the provider event identifier plus a stable fallback fingerprint.
- Reject unverified events; never let a webhook-supplied role or account identifier grant access.
- Do not log secrets, authentication headers, full payment credentials, OTPs or unnecessary personal data.

## Provider selection and failover

- Select providers by documented capability, destination/country support, commercial terms, latency, availability and data handling.
- Keep provider selection policy centrally controlled and observable.
- For communications, failover may be used only where consent, sender identity, delivery semantics and duplicate risk are understood.
- For financial operations, automatic provider failover is prohibited unless idempotency, transaction inquiry and duplicate prevention are proven end to end.
- Do not silently reroute regulated or identity-verification traffic to an unapproved provider.
- Preserve provider reference, route decision, cost, outcome and reason for every attempt.

## Secrets and environments

- Store credentials in Cloudflare Worker Secrets or an approved secrets manager.
- Use least-privilege API keys; prefer scoped keys over account-wide credentials.
- Keep sandbox and live credentials separate.
- Never place secrets in GitHub, issue text, test snapshots, source maps, logs or AI prompts.
- Rotate credentials through a reviewed procedure; do not rotate production secrets without an explicit release and recovery plan.
- An adapter must fail closed if required secret configuration is absent.

## Observability and cost controls

Record safe structured fields: Otya correlation ID, product, capability, provider, environment, operation type, duration, normalized result, retry count and cost when known.

Do not record message content, OTPs, passwords, API secrets, full bank/card credentials or sensitive identity documents in routine telemetry.

Required controls:
- Per-provider health and failure dashboards.
- Rate limits and spend thresholds.
- Destination/country capability allowlists for communications.
- Alerting for unusual volume, failure spikes and repeated retries.
- Usage reconciliation against provider statements/invoices.
- A kill switch that disables a provider route without taking down unrelated business functions.

## Portability and exit

Each adapter must document:
- Data Otya sends to the provider.
- Data returned or retained by the provider.
- Export or deletion methods and known limits.
- Alternative providers or manual continuity path.
- Migration and reconciliation steps.
- Contract termination and credential revocation steps.
- What cannot be migrated, including provider-owned identifiers or network entitlements.

A provider is considered replaceable only when the alternative has passed contract tests, security review, sandbox acceptance and a rehearsed cutover/rollback.
