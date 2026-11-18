# OTYA v1.7 — Cloudflare Full-System Handoff

Use this as ONE coordinated production audit. OTYA is one system even though responsibilities are isolated into `otya-store`, `otya-auth`, and `otya-ai` Workers in the same `PeterSmartLink/Otya-Server` repository.

## Safety rules
- Inspect live state before destructive changes.
- GitHub is source of truth for code/config; Cloudflare holds runtime secrets and live resource state.
- Never paste or commit secret values.
- The previously shared Telegram token must be revoked/regenerated in BotFather before production use.
- Preserve production data unless a migration/reset is explicitly approved.
- Do not create duplicate D1/KV/R2/Queue resources when the existing production resource is correct.

## 1. Workers and service topology
Verify/deploy exactly:
- `otya-store`: public website/API, release distribution, app remote config, notifications, telemetry intake, queues/producers, health/analytics, service gateway.
- `otya-auth`: authentication/account/Google OAuth/OTP/consent/backup auth and Resend transactional email.
- `otya-ai`: all AI inference, Telegram AI support, AI queue consumption, feedback categorization/moderation, crash grouping, changelog generation, anomaly analysis, churn prediction, smart replies, AI-generated update notification jobs.

Verify service bindings:
- `otya-store.AUTH -> otya-auth`
- `otya-store.AI_SUPPORT -> otya-ai`
Public `/api/telegram/*` remains under the canonical OTYA domain through `otya-store`, which proxies internally to `otya-ai`.

## 2. otya-ai live configuration
Deploy from `ai-worker/wrangler.toml`.
Verify Workers AI binding `AI` is enabled only on the AI runtime where required.
Verify D1 `DB` points to existing `otya-store-db` (`ab157fc6-2cbb-4d46-9789-2e4392e16aea`).
Verify KV `KV` points to existing namespace `3f179286e0fc4dbfa2332884cdf81312`.
Verify `PUSH_QUEUE` producer points to `otya-push-queue`.
Verify `otya-ai` is the sole consumer of `otya-ai-queue` with DLQ `otya-ai-queue-dlq`.
Do not make `otya-store` an AI queue consumer again.
If a production Vectorize index already exists for crash grouping, bind it to `otya-ai` as `VECTORIZE`; do not invent a replacement index. If none exists, document that and leave deterministic crash grouping fallback active until an index is intentionally created.

Set/preserve these `otya-ai` secrets server-side only:
- `TELEGRAM_BOT_TOKEN` — NEW regenerated full BotFather token, never the exposed old token.
- `TELEGRAM_WEBHOOK_SECRET` — generate a strong random secret.
- `INTERNAL_SECRET` — shared only if needed for authenticated internal AI actions; use the repository-approved shared value, not a new incompatible value.

Public/non-secret AI vars:
- bot `@OtyaPlayerBot`
- channel `https://t.me/otyaplayer`
- default Workers AI model from repo unless Cloudflare reports it unavailable/deprecated.

## 3. Telegram webhook
After `otya-ai` and `otya-store` are deployed, configure Telegram webhook to canonical endpoint:
`https://petersmartlink.com/api/telegram/webhook`
Use the same `TELEGRAM_WEBHOOK_SECRET` as Telegram `secret_token` so Telegram sends `X-Telegram-Bot-Api-Secret-Token`.
Verify `/api/telegram/status` through canonical domain reports service available without exposing token values.
Test `/start`, `/privacy`, `/channel`, normal OTYA support question, unsupported/account-sensitive question, and AI/provider failure fallback.
Never ask users for passwords, OTPs, JWTs, API keys or bot tokens.

## 4. otya-store resources
Verify `otya.site` and `www.otya.site` are canonical public domains; retain the legacy domain only for controlled compatibility until clients and callbacks have migrated.
Verify R2 `R2 -> otya-player-releases`.
Verify KV `KV -> 3f179286e0fc4dbfa2332884cdf81312`.
Verify D1 `DB -> otya-store-db` (`ab157fc6-2cbb-4d46-9789-2e4392e16aea`).
Verify `PUSH_QUEUE` producer/consumer and its DLQ.
Verify `AI_QUEUE` is producer-only on store.
Verify `OTYA_RELEASE_WORKFLOW` / class `OtyaReleaseWorkflow` is live.
Verify `OTYA_ANALYTICS` dataset if Analytics Engine is enabled; if account feature is unavailable, document the limitation rather than breaking deployment.
Verify rate limiter binding.
Verify cron triggers match repository.
Verify remote config and themes catalog are repository-approved values and published to the expected KV keys/routes.
Verify release-publisher R2 cache normalization and version/checksum/ABI metadata.

## 5. otya-auth resources
Verify D1 `AUTH_DB -> otya-auth-db` (`b05595f6-260a-4720-acca-4f8b13f5c43e`).
Verify KV `AUTH_KV -> 6b9faff751724fdb86c16452b9c99cf6`.
Verify `GOOGLE_CLIENT_ID` equals the repository value.
Verify secrets: `AUTH_JWT_SECRET`, `RESEND_API_KEY`; preserve approved `INTERNAL_SECRET`/store internal configuration where used.
Verify Google OAuth, email/password auth, refresh/session invalidation, verification OTP, password reset, same-email Google linking, account deletion, backup/Drive authorization, consent endpoints.

## 6. Email/Resend
Audit all live automated client email paths. Automated email must use `noreply@otya.site`; human support/reply path uses `support@otya.site`. Continue checking the legacy `support@petersmartlink.com` inbox alias during migration.
Verify Resend domain/sender is validated.
Test personalized welcome email with the actual user's display name, verification OTP, password-reset OTP, security/new-device notice, account/legal notice and backend health/admin mail.
Transactional/security/legal email must not depend on marketing opt-in. Promotional email must require marketing consent and have preference/unsubscribe handling before campaigns are enabled.
Once ALL live Resend acceptance tests pass, remove the legacy Cloudflare Email binding/code path in a controlled GitHub change. Do not remove it merely because a secret exists.

## 7. Consent/legal
Verify D1 consent storage exists and is durable.
Terms and Privacy acceptance must be explicit for new v1.7 registrations; marketing consent is separate and optional.
Verify consent version/timestamps and re-acceptance behavior for material Terms/Privacy changes.
Verify Google-created new accounts cannot bypass required legal acceptance.
Do not treat compatibility-mode implicit acceptance as final production legal behavior.

## 8. D1 migrations/data integrity
List applied migrations for both databases and compare with repository migrations/schema.
Apply only missing repository-approved migrations in order.
Verify required tables/indexes for releases, analytics, feedback AI fields, crash reports, consent, sessions/devices, playlists/history/preferences/bookmarks/pro/ratings/feedback/download analytics as applicable.
Do not recreate old reset user/auth state that was intentionally removed for the new app generation.
Run integrity checks after migrations and report exact applied migration IDs.

## 9. Security/privacy
Confirm no secrets are plaintext vars or committed source.
Rotate the exposed Telegram bot token before webhook activation.
Verify service bindings are preferred over public internal URLs.
Verify rate limits on public auth, feedback, crash and Telegram surfaces.
Verify webhook secret validation.
Verify logs/Analytics Engine do not record passwords, OTPs, JWTs, API keys, bot tokens or unnecessary personal data.
Verify CORS and security headers on public API routes.
Verify R2 release downloads cannot become an arbitrary-object disclosure path.

## 10. Notifications/releases/health
Verify FCM/push queue credentials and delivery paths server-side.
Verify release workflow, version endpoint, latest endpoint, R2 artifact, checksum and app update metadata agree on v1.7 release artifacts when published.
Verify scheduled health checks and recovery alerts.
Verify AI update-notification jobs flow `otya-store -> AI_QUEUE -> otya-ai -> PUSH_QUEUE -> otya-store consumer` without loops.

## 11. End-to-end acceptance
Do not declare production ready until all pass:
1. website and API health
2. registration/login/logout/refresh
3. Google sign-in/linking
4. OTP verification/reset delivery
5. personalized welcome/security emails
6. consent and re-acceptance
7. account deletion/session revocation
8. remote config/themes
9. feedback + AI categorization/moderation
10. crash ingestion + AI grouping fallback/Vectorize
11. Telegram webhook + AI answer + safety fallback
12. push queue/update notification
13. release workflow/R2/version/checksum
14. D1 migration verification
15. analytics/privacy checks
16. no secret exposure

Return a final report with: live Worker versions, bindings/resources, secret NAMES present (never values), migrations applied, webhook status, Resend tests, queue tests, failed checks, exact blockers, and any GitHub changes still required. Do not claim a check passed without executing/verifying it.
