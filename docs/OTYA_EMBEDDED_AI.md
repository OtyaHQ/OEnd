# Otya product intelligence

Otya's products have separate responsibilities and user-facing boundaries.

## Product boundaries

- **OID** owns account identity, authentication and account security.
- **OEnd** owns shared internal APIs, service integrations, release delivery, audit and operational data.
- **O** is the private owner workspace for company operations, system oversight and approval-gated actions.
- **Omy Play** remains a local-first media product. Local playback and library functions must not depend on O, OID or OEnd being online.
- **Opoint** owns the company's private retail, inventory, cash, staff and mobile-money operations. Its financial records remain isolated from other products.

## Private owner intelligence

O is available only through the authenticated owner workspace at `https://space.otya.site/admin/ai`. The website does not provide an anonymous or public chatbot.

The public `/api/ai/chat` endpoint is intentionally disabled and returns an owner-only response. Do not add guest chat, public model selection, or public conversation persistence to the O Worker.

O may inspect approved internal data through authenticated OEnd service APIs. Provider credentials, customer records and business secrets remain server-side. High-impact or destructive actions require the owner's authorization and an explicit approval gate.

## Product support

Public product help and support live on the official Otya website. Customer support tools, inbox access and reply drafting are private owner capabilities; they must never be exposed as an anonymous chat surface.

## Release and privacy rules

- Keep product-specific databases isolated and use documented service contracts.
- Do not treat a successful model response, a notification or an AI-generated summary as proof that a business or financial action occurred.
- Do not expose passwords, OTPs, session tokens, API keys, provider credentials or private operational data to model prompts or browser code.
- Local-first product functionality must keep working when cloud services or AI are unavailable.
- A code merge, build or staging run is not evidence of a production deployment.
