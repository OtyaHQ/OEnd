# OTYA AI Support Console

Private Admin surface inside Otya Space: `/admin/ai`

## What it does

- Lists recent inbound emails visible to the configured support receiving service.
- Reads an individual support message.
- Produces an AI draft with category and risk level.
- Requires explicit administrator approval before sending.
- Sends approved replies through the configured Otya support sender.
- Preserves normal email threading where supported.
- Records draft/send audit metadata.

## Identity and authorization

The administrator signs in with the normal Otya account. Admin is a server-authorized role inside that same identity, not a separate account.

When fresh owner verification is required, it is completed through the normal Otya sign-in journey. The browser then carries a short-lived, signed Admin session in addition to the normal Otya account session. Every privileged API still verifies authorization server-side.

There is no supported workflow where an administrator pastes an Admin bearer token into the browser.

## Secret boundary

The browser never receives email-provider keys, internal service credentials, signing secrets or infrastructure tokens.

Server-side components may use private service-to-service credentials to reach support/AI/email providers. Those credentials remain in the appropriate secret store and are never rendered into the Command Center, returned through public APIs or included in ordinary chat history.

If a required private credential or binding is unavailable, the privileged action fails closed.

## Production prerequisites

- The configured support receiving and sending service is healthy.
- Required private service credentials are present only in the relevant server secret stores.
- Owner/Admin identity and verification are configured.
- Support mail routing is verified without destructively replacing unrelated mailbox routing.

## Default sending policy

Auto-send is intentionally disabled. The production workflow is `draft -> review/edit -> approve & send` unless a separately reviewed policy explicitly authorizes a narrower automated action.

High-risk subjects such as security, billing disputes, account deletion, data export, legal issues or suspected compromise remain human-reviewed.
