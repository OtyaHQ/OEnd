# Legacy resource cleanup and retirement register

This register separates proven-dead product code from shared infrastructure that must remain until a controlled cutover.

## Known cleanup candidates

| Candidate | Evidence | Current handling | Retirement gate |
|---|---|---|---|
| Jamendo client credentials on shared Core Worker | Current Otya contract marks Online Music/Jamendo retired; code validation forbids Jamendo credential variables and the current app contract forbids remote music playback | Retain the credential values as protected backups; do not pass them into new product Workers | Confirm no route, scheduled task or external integration uses them; archive ownership/rotation note; remove only the obsolete Core Worker bindings after a staged replacement |
| Telegram OIDC client ID/secret on shared Auth Worker | Auth source contains Telegram OIDC start/callback flows | Keep untouched on the current Worker while OTP-only Auth is staged | New email OTP and linked-bot delivery pass registration, login, session refresh/revocation and recovery tests; then remove OIDC routes, UI, secrets and docs together |
| Telegram Mini App auth path | Auth source validates WebAppData and can create an Otya user/session when no bearer session exists | Treat as prohibited in the target contract; do not route new product sign-in through it | Disable in staged Otya ID and remove after clients migrate; keep bot webhook only for OTP delivery, never account creation |
| Old Omy Play endpoints in shared Core Worker | Device registration, FCM, Together and release endpoints exist in shared Core | New Omy Play Worker/D1/R2/KV foundation is prepared separately | Staging mobile build calls the isolated Worker; all API, update, FCM and Together flows pass; then remove product endpoints from shared Core |
| Legacy otya-player Firebase project/defaults | Omy Play now has a separate omyplay-otya-prod project and app identity | Preserve old project, keys and release references as migration/rollback assets | Confirm no installed build or public release depends on the old project; archive recovery data; then separately approve decommission |
| Historical petersmartlink.com/download/otya-player and asset paths | Current client config and public release history still refer to them | Keep as compatibility aliases | New release endpoint, domain and update metadata verified on test devices; migrate public links before alias retirement |

## Cleanup rules

- Delete product-owned source only after a reference scan, test update and rollback plan.
- Do not remove credentials from a shared Worker merely because the new product does not use them. A secret may have another consumer or be needed for rollback.
- Do not delete a D1 database, KV namespace, R2 bucket, queue, custom domain, certificate, DNS record, account or backup based only on an old name.
- Keep archive docs when they explain a migration or compatibility decision; mark them historical instead of deleting engineering history.
- Any production resource deletion or credential revocation requires a proven owner, dependency scan, recovery plan and explicit release gate.
