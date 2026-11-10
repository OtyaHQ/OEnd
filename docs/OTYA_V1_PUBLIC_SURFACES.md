# OTYA v1 Public Surface Architecture

Status: canonical public-information map

The Otya ecosystem must feel like one organized platform with clear product boundaries, not a collection of internal services or unrelated landing pages.

## 1. Main site — petersmartlink.com

Purpose: **Otya brand + product discovery**.

Primary navigation:
- Products
- Otya
- Developers
- Company
- Support

Account/resource actions:
- Docs
- Sign in / Space

Secondary/footer links:
- Documentation
- Status
- Privacy
- Terms
- Contact
- Delete account

The homepage must quickly explain:
1. Otya is the public umbrella brand.
2. What products currently exist.
3. Where Otya Media belongs in that portfolio.
4. How to reach Docs, Status and Space.
5. A clear product discovery action.

Otya Media has its own product page. Do not make the Otya homepage look like the company and a single Android app are the same entity.

Do not expose internal infrastructure or unfinished product claims.

## 2. Docs — docs.petersmartlink.com

Purpose: public product guidance and user documentation.

Top-level structure:

- Get started
  - Otya Media overview
  - Install safely
  - First launch
  - Media permissions
- Playback & local media
  - Video controls
  - Music library
  - Background playback
  - Picture-in-picture
  - Search
- Transfer
  - Nearby devices
  - Send / receive
  - Security/privacy
  - Troubleshooting
- Private
  - Protect media
  - Import/export/restore
  - Uninstall/data implications
- Media Tools
  - Trim
  - Extract audio
  - Supported formats
  - Output location
- Next
  - What Next can do
  - Current information
  - Otya guidance
  - Limitations
  - Privacy
- Account & Space
  - Create/sign in
  - Google sign-in
  - Multiple sign-in methods / one Otya identity
  - Recovery
  - Delete account
  - Backups/sync only when live
  - Role-aware Admin behavior at a safe user level
- Troubleshooting
- Contact support

Forbidden in public Docs:
- Cloudflare Worker names/topology
- D1/KV/R2 identifiers
- queue identifiers/topology
- secrets or credentials
- internal authorization implementation details
- raw logs
- private API routes
- internal model-routing policy
- release-control internals
- incident playbooks

## 3. Status — status.petersmartlink.com

Purpose: safe operational transparency.

Public components:
- OTYA Accounts
- Next
- OTYA Web
- Downloads & Updates
- OTYA Space

States:
- Operational
- Degraded performance
- Partial outage
- Major outage
- Maintenance

Incident stages:
- Investigating
- Identified
- Monitoring
- Resolved

Never expose stack traces, internal service names, database details or security-sensitive diagnostics.

## 4. Space — space.petersmartlink.com

Purpose: one signed-in environment for one Otya identity.

Signed out:
- Sign in
- Create Otya Account
- Google sign-in
- Telegram sign-in where supported
- Recover account
- Concise explanation of Space

Signed in:
- Space home
- account summary
- sign-in methods
- security
- devices & sessions
- activity
- preferences
- data/recovery
- notifications
- Next
- Telegram
- role-authorized Admin entry point
- sign out

### Admin inside Space

Admin is not a separate account or a second username/password system.

The server resolves the signed-in Otya identity to roles. If the account is eligible for Admin and fresh owner verification is required, that verification is completed through the normal Otya sign-in journey or as step-up verification for a high-impact action. Once authorized, Admin appears as part of the same Space environment.

Normal users must never gain Admin capability by entering an Admin URL. UI visibility never replaces backend authorization.

Do not show raw infrastructure, deployment secrets, logs or owner-only implementation details to normal users.

## 5. Products — petersmartlink.com/apps

Purpose: portfolio view of current Otya products and connected surfaces.

Current product presentation may include:
- Otya Media
- Next
- Space

Do not fill the portfolio with speculative or placeholder products merely to look larger.

## 6. Developers — petersmartlink.com/developers

Purpose: safe developer-facing resources.

May link to:
- public documentation
- service status
- security reporting
- contact
- explicitly supported public interfaces

Do not expose private production topology as though it were a public developer API.

## 7. Company — petersmartlink.com/company

Purpose: explain the Otya ecosystem, intended parent company and product principles. Otya Holdings Limited is in the process of URSB registration; do not claim it is already incorporated.

Keep this factual. Do not fabricate company size, customers, awards, offices, partnerships or metrics.

## 8. Support

User-facing support categories:
- Help Center / Docs
- Report a problem
- Account help
- Privacy request
- Security report
- General contact

Categories may initially share backend/mail infrastructure, but the user-facing intake should remain organized.

## 9. Privacy / Terms / Security

Privacy must reflect actual Otya behavior, including:
- local vs server-processed data
- Otya Account data
- Next prompts/conversations and retrieval
- Transfer behavior
- Private media behavior
- analytics/crash reporting
- retention/deletion
- user rights/request path

Security guidance should provide safe commitments and a responsible reporting path without publishing exploitable architecture.

Terms should describe actual supported services and responsibilities, not speculative features.

## 10. Changelog

Use user-language grouped as New / Improved / Fixed.

Do not mix current incidents into the changelog. Do not publish internal deployment notes as customer-facing release notes.

## 11. SEO / crawler policy

- Normal public search indexing: allowed.
- `/api/`: disallowed from search crawling.
- AI training: disallowed (`ai-train=no`).
- Do not enable broad AI crawlers merely to fix AI Search ingestion.
- AI Search crawler exceptions must be deliberate and narrow enough to preserve the public content policy.

## 12. Canonical public/private boundary

The web gateway remains the only public application entry point. Private identity and assistant services must not become public endpoints merely for convenience.

Internal physical compatibility identifiers may remain unchanged during v1 unless an explicit migration is separately approved and tested. Public documentation describes user-facing behavior, not internal service topology.
