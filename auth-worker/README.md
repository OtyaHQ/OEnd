# OTYA Auth — Cloudflare Worker

Authentication service for **OTYA**. It powers registration, login, Google sign-in, email verification, password recovery, optional phone verification, linked identities, JWT issuance, consent and account security.

## Architecture

OTYA Auth owns identity and security. It does not own the user's local music, video or file library.

- Local OTYA playback must work without signing in.
- Local media scanning must not depend on the auth service.
- Account features can use the stable OTYA `user_id` from the JWT `sub` claim.
- Backup, sync and connected features may require an account.
- Phone numbers and recovery details are optional account-security information.
- The auth design stays reusable internally, but the public product is simply OTYA.

## Setup

### Core resources

Create/bind the existing production D1 database and AUTH_KV namespace, then apply `schema.sql` for a new environment. Production deployments use the IDs in `wrangler.toml`.

### Required secrets

```sh
wrangler secret put AUTH_JWT_SECRET
wrangler secret put RESEND_API_KEY
```

Google identity uses the configured `GOOGLE_CLIENT_ID` variable. Sensitive values must remain server-side.

### Telegram security verification and OTP delivery

Telegram is **not** a normal Otya account sign-in method. Email/password and Google remain the account access methods. Two separate Telegram security capabilities are supported:

1. **Linked Telegram identity** — an already signed-in user can link a Telegram identity. It is used only for owner-only step-up verification; it cannot create or resume an Otya account session.
2. **Private OtyaPlayerBot chat** — an already signed-in user can link a private bot chat separately to receive one-time security codes. This is stored as the independent `telegram_otp_bot` identity and never grants sign-in access.
3. **Telegram Gateway** — optional phone verification transport; it is not an account sign-in provider.

Configure the callback:

```text
https://petersmartlink.com/auth/telegram/callback
```

Optional owner-verification and phone-verification secrets:

```sh
wrangler secret put TELEGRAM_LOGIN_CLIENT_ID
wrangler secret put TELEGRAM_LOGIN_CLIENT_SECRET
wrangler secret put TELEGRAM_GATEWAY_TOKEN
```

Telegram bot OTP delivery uses the existing Otya Core bot and a private Auth → Core service binding. Link the bot chat from Account → Sign-in methods after signing in with Google or email. Do not expose the bot token or internal service secret to the browser.

Never put Telegram client secrets or Gateway tokens in Flutter or browser code.

## Email provider

OTYA uses **Resend** for verification, password reset, welcome and security email.

### Private OtyaPoint staff invitations

The Auth Worker also owns the private `POST /internal/notifications/omnipoint/staff-invitation` service-binding route. It sends invitation messages on behalf of OtyaPoint using the existing Resend account; OtyaPoint does not receive a Resend API key. The route rejects requests without both the expected `x-otya-service: otyapoint` marker and a high-entropy shared service secret.

To enable this integration after an approved isolated OtyaPoint deployment, generate a unique high-entropy value and set the exact same value as a Worker secret in both OtyaPoint and Otya Auth:

```sh
wrangler secret put OTYAPOINT_INVITE_SERVICE_TOKEN
```

Do not use a Wrangler `[vars]` value, GitHub source file, app bundle, or browser storage for this secret. The invitation code is one-time, short-lived and stored only as a digest by OtyaPoint. Do not configure this secret or enable invitation delivery on production during the development freeze. The internal route is not a public API and must not be attached to a public route or workers.dev hostname.

## API

All endpoints return `{ error: string }` on failure.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | None | Email + password signup |
| POST | `/auth/login` | None | Email + password login |
| POST | `/auth/refresh` | Refresh token | Issue a new access token |
| POST | `/auth/logout` | Refresh token | Revoke refresh token |
| POST | `/auth/google` | Google token | Google login/signup |
| POST | `/auth/forgot-password` | None | Send password-reset OTP |
| POST | `/auth/reset-password` | OTP | Reset password and revoke refresh sessions |
| POST | `/auth/send-verification` | Bearer JWT | Send email verification OTP |
| POST | `/auth/verify-email` | Bearer JWT | Verify email |
| GET | `/auth/account` | Bearer JWT | Account profile and linked identities |
| PATCH | `/auth/account` | Bearer JWT | Update optional profile fields |
| POST | `/auth/telegram/start` | Bearer JWT | Start Telegram linking |
| GET | `/auth/telegram/callback` | OIDC state/code | Complete Telegram linking |
| POST | `/auth/phone/request` | Bearer JWT | Send optional verification code |
| POST | `/auth/phone/verify` | Bearer JWT | Verify phone |
| POST | `/auth/delete-account` | Bearer JWT | Delete account and revoke tokens |
| GET | `/auth/verify` | Bearer JWT | Validate JWT |
| GET | `/auth/me` | Bearer JWT | Legacy/basic account response |
| PATCH | `/auth/me` | Bearer JWT | Legacy/basic profile update |
| POST | `/auth/backup` | Bearer JWT | Write Google Drive backup |
| GET | `/auth/backup` | Bearer JWT | Read Google Drive backup |
| DELETE | `/auth/backup` | Bearer JWT | Delete Google Drive backup |

## Account information

Signup stays small: email, authentication credential, optional name and legal consent. Users can later add profile photo, verified phone, recovery email, country/region, locale and timezone.

Do not collect date of birth, gender, physical address, national ID/passport data or precise location unless OTYA has a clear future need and matching privacy controls.

## Token and OTP contract

- **Access token:** HS256 JWT, 15-minute TTL. Payload: `{ sub, email, iat, exp }`.
- **Refresh token:** random token stored in KV with a 30-day TTL.
- **Email verification/password-reset OTP:** exactly **5 characters** matching `^[A-Z][0-9]{4}$`.
- OTPs are single-use and rate-limited.

## Branding

The public product is **OTYA**. The account is a supporting part of OTYA, not a separate product. Otya is the public product brand. For provider accounts still contracted in an individual's name, the verified account holder remains the legal account identity until incorporation and formal provider approval.
