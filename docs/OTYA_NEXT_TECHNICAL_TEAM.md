# Otya Next integrated technical team

Otya Next uses one private owner-assistant runtime with logical specialist roles. It does not create one Worker, database, model subscription or paid service per role.

## Roles
- AI Team Lead — ecosystem triage, prioritization and cross-product coordination.
- Backend Engineer — Workers, APIs, service contracts and server-side behavior.
- Database Engineer — D1 schema, integrity and migration safety.
- DevOps Engineer — GitHub delivery, Cloudflare runtime, monitoring and recovery.
- Security Engineer — identity, permissions, secrets and trust boundaries.
- Product Engineer — web/mobile experience, usability and accessibility.
- Integration Engineer — existing Cloudflare, GitHub and Resend connections, plus approved provider adapters.
- OtyaPoint Operations Specialist — retail, stock, cash, float and reconciliation workflows.
- Quality and Reliability Engineer — acceptance, regression and failure analysis.
- Documentation Engineer — source-aligned runbooks and architecture records.

## Runtime behavior
The owner message is classified with bounded, deterministic rules and the selected specialist's focus is added to the existing Otya Next owner-chat system context. The assistant returns the selected role as metadata so the owner interface can display or use it.

Routing is advisory only. It does not create identity, permissions, connector access or execution rights. Existing authenticated owner-console routes, service bindings, tool allowlists and approval requirements remain authoritative. Unknown tasks stay with the AI Team Lead.

## Operating principles
- Improve existing services before adding another service or provider.
- Keep OtyaPoint business and financial records isolated from shared identity data.
- Use source evidence and distinguish local/branch-only work from deployed state.
- No production deploy, DNS or secret change, remote migration, data deletion, live payment or external message without the established owner approval.
- Tests are delivery safeguards, not a substitute for implementing useful product behavior.
