# OTYA Server / Backend Security Policy

## Reporting a vulnerability

Do not publish production secrets, API keys, JWTs, refresh tokens, OTPs, Cloudflare credentials, Resend credentials, Google tokens, signing material, private user data, exploit details or account-recovery material in issues, pull requests, discussions, logs or screenshots.

Use the repository's private GitHub Security Advisory flow when available. If that is unavailable, use the official security contact published on the Otya website at `otya.site` and state clearly that the report is security-sensitive.

A useful report should include the affected component, reproducible steps, expected and actual behavior, security impact, and sanitized evidence with all credentials and personal data removed.

## Security-sensitive components

Extra review is required for:
- `otya-auth` authentication and session logic;
- password hashing, OTP and password-reset flows;
- Google token verification and Drive recovery proxy logic;
- Resend/email adapters and notification delivery;
- D1/KV/R2 access, schema changes and migrations;
- queues, scheduled jobs and release workflows;
- Cloudflare bindings, routes and Wrangler configuration;
- admin endpoints, service bindings and authorization;
- remote configuration and update/release metadata;
- GitHub Actions deployment, security and release changes.

## Secret handling

Secret values must never be committed to this repository. Use GitHub Actions secrets and Cloudflare secret storage. Public/client configuration may be committed only when it is intentionally non-secret, such as a Google OAuth client ID.

Never log authorization headers, JWTs, refresh tokens, OTPs, Google access tokens, Resend API keys, Cloudflare API tokens, signing passwords, private keys or internal shared secrets.

If a secret is suspected to have been exposed, rotate or revoke it at the provider and review affected sessions/deployments. Removing it from the latest commit alone is not sufficient remediation.

## Production change safety

GitHub Actions remains the deployment source of truth. Production changes should be reviewable, reproducible and reversible where practical.

- Preserve D1/KV/R2 data during ordinary deployments.
- Do not delete production user data unless the deletion is explicitly authorized and documented.
- Validate migrations before production use.
- Keep authentication, email and release credentials server-side.
- Production release signing must fail closed when signing material is missing.
- Do not weaken rate limiting, authorization, Turnstile or service boundaries to work around a deployment problem.
- Do not expose internal infrastructure inventories as public product documentation.

## Supported production line

Security fixes are maintained for the current OTYA production system and current supported client release line. Legacy application data and unsupported historical releases are outside the current production compatibility contract unless explicitly stated otherwise.
