# Otya production security baseline

Assessment date: 10 November 2026

This is an operational inventory and target baseline, not a claim of a formal certification. Recheck settings and provider terms before each major release.

## 1. Cloudflare — verified state

### Account and plan
- Account type: Standard.
- The petersmartlink.com zone is on Cloudflare Free Website.
- The Workers billing subscription could not be read with the currently connected OAuth scope. Do not infer the Workers plan or enable paid products until billing is reviewed in the dashboard.
- There is one accepted account member. That member currently has 2FA enabled.
- Account-wide enforce_twofactor is currently false. A safe API update was attempted but rejected because Cloudflare's account update endpoint rejected the existing account display name. The display name was not changed. Enable account-wide enforcement in the dashboard after confirming recovery codes are stored.

### Edge security
Verified active:
- SSL mode Full (Strict).
- Minimum TLS 1.2.
- Always Use HTTPS and Automatic HTTPS Rewrites.
- HSTS enabled, with includeSubDomains and preload.
- HTTP/3 and Brotli.
- DNSSEC active.
- Zone security level high.
- Cloudflare Managed Free WAF ruleset executed from the active OTYA Managed WAF ruleset.
- Otya custom firewall rules: known good bots are exempted from specific mitigations; medium threat-score traffic receives Managed Challenge; high threat-score traffic is blocked.
- A rate-limit ruleset protects authentication, admin, AI chat and download paths.
- Security response headers and static asset cache rules are present.
- No Cloudflare Access applications are currently configured. Do not put an Access login wall in front of public customer paths without first separating internal admin paths and validating sign-in flows.

Review WAF and rate-limit events monthly. Do not enable blanket Bot Fight Mode, Browser Integrity Check, or aggressive challenges without checking legitimate sign-in, API, email callbacks, downloads and mobile clients.

### Workers, storage and recovery
- Workers: otya-auth, otya-core, otya-next.
- All three currently have Cloudflare logs/traces enabled and query-string redaction enabled.
- Trace sampling is 5%; log sampling differs by Worker.
- Core has Cloudflare Issues detection enabled. The Next 16 release branch now declares Issues detection enabled for Auth, Core and Next, so a successful production deployment will align all three.
- Core, Auth and OtyaPoint D1 Time Travel recovery points were previously verified.
- R2 export backups were written and downloaded for SHA-256/byte-count verification. A restore drill has not yet been certified.

Minimum operating controls:
- Use distinct least-privilege API tokens for Worker deployment, D1/R2 backup, and read-only audit.
- Keep runtime secrets in Cloudflare secrets/Secrets Store, never in source, GitHub commits, build logs or frontend variables.
- Keep production D1 migration approvals explicit and preserve pre-migration backups.
- Perform scheduled restore drills into an isolated database; verify schema and row counts before calling recovery proven.
- Set monthly spending/usage alerts and review Workers/D1/R2 usage. Upgrade only when measured usage or required security features justify it.

## 2. GitHub — required repository controls

The ecosystem repositories are public, which allows use of public-repository security features without assuming a paid private-repository GHAS entitlement.

Verified:
- Dependabot weekly schedules already exist for OtyaEnd, OtyaPoint, OtyaHub and Leo.
- OtyaEnd has an active default-branch ruleset, but it currently only blocks deletion and force-push.
- OtyaPoint, OtyaHub and Leo have no repository rulesets.
- Branch-protection endpoints are not available to the current GitHub app connection, so these settings must be confirmed/configured in GitHub Settings.
- OtyaEnd's existing Security workflow gates CodeQL and Dependency Review on a repository variable called GHAS_ENABLED. The Next 16 upgrade branch removes this gate and runs them on pull requests, main pushes and scheduled scans, using pinned action SHAs.

Required ruleset for every production repository:
1. Require pull requests to merge into main; do not allow direct pushes.
2. Require at least one independent approval when another maintainer is available. Until then, keep the owner as the only administrator and do not grant unnecessary write access.
3. Require all relevant checks: tests, type-check, lint, production build, security baseline, CodeQL, dependency review, and post-deploy smoke tests where applicable.
4. Require conversations to be resolved; dismiss stale approvals after new commits.
5. Block force pushes and branch deletion; do not allow bypass except a documented break-glass administrator.
6. Protect .github/workflows/**, wrangler*.toml, package*.json, migrations, security policy and payment-provider adapters using CODEOWNERS/review rules.
7. Use GitHub Environments for production deployment; restrict deploy jobs to main, required reviewers where available, and branch/tag restrictions.
8. Use minimal GITHUB_TOKEN permissions, pin third-party actions to full commit SHAs, use OIDC where a provider supports it, and upload build provenance/attestations when supported.
9. Keep Dependabot grouped for minor/patch updates and separate major-version PRs. Never auto-merge critical runtime upgrades without CI.

Free public-repository baseline:
- Enable Dependabot alerts and security updates.
- Enable secret scanning and push protection if available in repository Security settings.
- Enable CodeQL default setup or use the repository's pinned CodeQL workflow.
- Enable dependency graph and vulnerability alerts.
- Review security advisories and exposed secrets immediately; rotate exposed credentials rather than merely deleting a commit.

## 3. Resend — verified state

- petersmartlink.com is verified in us-east-1; sending and receiving are enabled.
- Resend DKIM, SPF, MX and tracking CNAME records are verified.
- DMARC currently uses p=quarantine. Keep aggregate reports monitored; do not move to p=reject until all legitimate senders, forwarded mail and domain subdomains have been audited.
- Open and click tracking are off, preserving a privacy-friendly default.
- The active webhook is enabled and the last 20 inspected event deliveries succeeded.
- Webhook events currently include sent, delivered, delayed, complained, bounced, failed and suppressed.
- There are three named API keys: Auth Send Email, Deployment and otya-store-worker. Their secrets are not exposed in this inventory.

Required controls:
- Use a separate sending key per service and only the minimal send scope needed; do not reuse the deployment key at runtime.
- Rotate only after the corresponding Cloudflare secret has been updated and a delivery check has succeeded.
- Verify webhook signatures, enforce timestamp tolerance, store event IDs for idempotent processing, acknowledge quickly and process asynchronously.
- Handle bounced, complained and suppressed recipients; do not send promotional messages without recorded, revocable marketing consent.
- Keep open/click tracking off unless there is a lawful, disclosed business need and a suitable privacy setting.
- Add a second verified sending domain only when branding or reputation isolation is justified. Resend already supports the current verified domain; more domains are not inherently more secure.

## 4. Payments — hard production gate

Interswitch Marketplace Routing Bills Payment, Quickteller Bills Payment v5, Quickteller Business, and agency/acquiring services are separate products and contracts. Keep their adapters separate.

Before enabling any live payment or agent cash movement, retain:
- written Uganda-specific product/merchant enablement and signed agent/merchant agreement;
- provider terminal/merchant identity and approved credentials;
- confirmation of UGX support, billers, fees, limits, settlement, dispute and reversal semantics;
- callback signatures, transaction-status enquiry, idempotency and daily reconciliation tests;
- KYC/AML, agent training, complaint handling and cash/float procedures approved by the licensed principal.

Never treat PENDING or UNKNOWN as success, and never retry a money movement on a transport timeout without querying the original provider reference. Keep current Interswitch Bills client sandbox-only and submission disabled until the gates above are met.

## 5. Legal and privacy

The current public Terms and Privacy pages are app-centric. The separate compliance branch contains a Uganda checklist and an unapproved customer-policy drafting pack. Do not publish those drafts until the legal operator is registered and accurately identified, PDPO status and data-controller/processor responsibilities are confirmed, provider agreements are reviewed, EFRIS/tax treatment is checked with URA, and a Ugandan advocate approves the wording.

The consent backend change records Terms/Privacy versions and a separate marketing opt-in/withdrawal history. The Auth CI is passing, but the code has not been deployed to production.

## 6. Release gates and owner tasks

- [ ] Complete PR #266 (Next 16 / current OpenNext / Worker Issues configuration and public-repo security scanning) only after every check passes.
- [ ] Complete PR #267 (versioned consent history and Uganda compliance checklist) after independent review; then deploy Auth through the controlled mainline workflow.
- [ ] Enable Cloudflare account-wide 2FA enforcement in the dashboard; the only accepted account member already has 2FA enabled.
- [ ] Configure GitHub main-branch rulesets as specified above in all production repos.
- [ ] Complete a real isolated restore drill for Core, Auth and OtyaPoint databases.
- [ ] Confirm PDPO registration/classification/reporting position with PDPO promptly; the 2021 regulations set the annual report window at 90 days after the applicable financial year ends.
- [ ] Obtain Uganda-specific payment provider approvals before any live transaction.

No paid feature is being enabled by this checklist. Keep the free/open-source-first approach and upgrade only when a measured operational requirement justifies the cost.
