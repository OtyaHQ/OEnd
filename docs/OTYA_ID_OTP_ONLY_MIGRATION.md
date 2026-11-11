# Otya ID — OTP-only authentication migration

**Target sign-in policy:** email address + one-time code. A verified Telegram bot is an optional code-delivery channel. Telegram is not an identity provider and never creates an account or issues a session.

## The intended user experience

1. User enters their email address.
2. Otya ID checks the request without revealing whether an account exists.
3. The server delivers a one-time code to the verified email address and, when the user has explicitly linked the Otya Telegram bot, may also deliver it through the bot.
4. User enters the code in the product's sign-in screen.
5. Otya ID verifies the code, risk/rate limits and account state, then issues the normal Otya ID session.
6. Opoint and Omy Play exchange the same Otya ID identity for a product-specific authorization context. Neither product gets direct access to the other's data.

New-account registration is the same flow: verify email with a one-time code, then accept current terms/privacy and create the Otya ID record. There is no password login or social-provider sign-in in this target contract.

## Linking Telegram as a delivery channel

Telegram must not be able to sign a user in. The account is first verified through email. While authenticated, the user chooses **Connect Telegram for codes**. Otya ID creates a random, short-lived, single-use link challenge. The user opens the official Otya bot and completes that challenge. The bot webhook validates the update with the bot token and binds the chat ID to the already-authenticated Otya user.

The bot challenge:
- expires quickly and is consumed once;
- is bound to the initiating user and nonce;
- cannot create an Otya account or issue a session;
- never trusts a username supplied by the client;
- is stored as a hash and rate-limited;
- can be revoked from account security settings.

Once linked, Telegram is only a destination for a code requested against the user's email identity. A Telegram numeric ID or username is not an account identifier.

## OTP security

- Use a cryptographically secure random code and store only an HMAC digest, bound to purpose and normalized identity.
- Short expiry, single use, strict send/verification limits, generic responses that prevent account enumeration, and an audit event for every attempt.
- Email and Telegram sends have separate delivery status and idempotency keys. A failed Telegram send falls back to email; it must never create an unauthenticated session.
- Never log or persist raw OTP values; redact them from traces and error reports.
- Revoke or rotate outstanding sessions after sensitive account changes and explicit logout.
- Product membership, role and tenant checks remain in the product API on every request.

## Explicitly prohibited

- Telegram Login OIDC at /auth/telegram/start?mode=login and its callback.
- Telegram Mini App auto-login or account creation.
- Telegram Login Widget / OIDC identity linking as a sign-in substitute.
- Treating a Telegram username, bot message or Telegram numeric ID as proof of Otya ID account ownership.
- A product app minting its own access or refresh tokens.

## Migration and cleanup

The currently deployed shared Auth Worker contains legacy Telegram OIDC and Mini App flows. They are not removed from production by this document. Replace them only after:

1. Email OTP sign-in and registration are deployed to a dedicated staging Otya ID service.
2. Bot-link challenges, Telegram code delivery, email fallback, session refresh/revocation and abuse controls pass tests.
3. Opoint and Omy Play staging clients use the new OTP contract.
4. A rollback plan and owner-approved cutover are ready.

Then remove the Telegram Login/Mini App route handlers, OIDC client ID/secret and obsolete UI/docs/workflows. Keep only the bot delivery credential required for the optional OTP channel. Do not remove Telegram Gateway or bot messaging credentials that are still referenced by the OTP service.
