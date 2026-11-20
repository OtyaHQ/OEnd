# Otya Company Capability Catalogue

This is the capability map for the whole company, not a list of applications to create. One system may own several capabilities, and one UI may expose capabilities from several domains. Each capability must have an accountable owner, a source of truth, an access policy and a lifecycle.

## 1. Corporate governance and executive management

- Legal-entity and subsidiary register; jurisdiction, registration evidence and status.
- Shareholder, director, beneficial-owner and officer records, subject to applicable law and access restrictions.
- Governance calendar, resolutions, minutes, delegated authority and approval limits.
- Corporate policies, procedures, acknowledgement and version history.
- Strategy, annual plans, objectives, key results and management reporting.
- Department, cost-centre and business-unit structure.
- Product and venture portfolio, investment proposals and stage-gate decisions.
- Decision register with rationale, owner, date, evidence and review date.
- Organisation-wide risk appetite, escalation and exception register.

## 2. Finance, treasury, tax and audit

- Double-entry general ledger and controlled chart of accounts.
- Journal entries, posting periods, adjustments, closing and trial balance.
- Accounts payable/receivable, invoice register and payment status.
- Cashbook, bank accounts, cash drawer and cash-session reconciliation.
- Budgets, forecasts, cash-flow projections and spending controls.
- Expense claims, receipts, reimbursement and approval workflow.
- Revenue recognition and product/branch profitability.
- Fixed assets, depreciation, custody and disposal records.
- Tax calendar, tax computations, evidence and official-system integrations.
- EFRIS-related invoice data and status where legally applicable.
- Reconciliation between Otya records and operator, bank or payment-provider statements.
- Audit evidence, audit trail, variance investigation and corrective action.
- Financial close checklist and management accounts.
- Treasury access, payment authorisation and dual-control policy.

## 3. Retail, commerce and customer transactions

- Product catalogue, variants, categories, serial numbers and barcodes.
- Price books, promotions, discounts, tax treatment and approval limits.
- Point of sale, sales, returns, exchanges, refunds and receipts.
- Customer orders, reservations, fulfilment and order status.
- Customer balances and credit controls where legally and commercially approved.
- Till assignment, cash opening, cash movements, cash closing and variance review.
- Warranty, repairs, device history and after-sales service.
- Multi-branch stock transfers and branch-level reporting.
- Offline transaction capture with safe synchronization and duplicate prevention.
- Sales analytics and gross-margin reporting based on posted source records.

## 4. Mobile-money agency operations

- Operator/provider and agency-account register.
- Agent line, till, terminal and device inventory with separate identity-purpose labels.
- Cash drawer and operator float account separation.
- Opening float, cash in/out, transfers, commissions and closing balances.
- Maker/checker controls for sensitive adjustments and reversals.
- Transaction reference capture, duplicate detection and idempotency.
- Daily operator statement import and reconciliation.
- Unmatched transactions, reversals, disputes and provider follow-up.
- Staff assignment to agency accounts and branch-level permission scopes.
- Cash/float limits, thresholds, shortage/surplus alerts and escalation.
- Operator API health, service status and maintenance windows.
- Provider settlement and commission evidence.
- Clear distinction between customer KYC identity, employee identity and the operational agent line.

Otya owns the agency-management records, controls, calculations and reconciliation workflow. The licensed operator owns the actual mobile-money network, customer wallet and regulated transaction rails.

## 5. Inventory, procurement and supply operations

- Supplier, supplier contact and supplier due-diligence register.
- Purchase requisitions, quotations, comparisons and approval.
- Purchase orders, goods received, invoice matching and supplier returns.
- Stock locations, bins, stock counts and adjustments.
- Stock movements, transfers, reservations and reconciliation.
- Reorder points, low-stock and dead-stock analytics.
- Serial/IMEI capture where appropriate, with access and privacy controls.
- Warranty, repair, damaged goods and disposal workflow.
- Shipment, delivery, proof-of-delivery and returns.
- Supplier performance, lead time, quality and pricing history.
- Procurement budgets, conflict-of-interest declarations and approval thresholds.

## 6. People, workforce and payroll

- Employee/contractor profile and verified employment documentation.
- Recruitment, selection, offer and onboarding checklist.
- Role, department, location, manager and work assignment.
- Duty roster, shift planning, attendance, leave and overtime records.
- Staff device, SIM, key and equipment assignment/return.
- Training, competency, policy acknowledgement and certification.
- Performance objectives, coaching and review history.
- Payroll inputs, salary, allowance, deduction and payslip records.
- Offboarding, access revocation, asset return and knowledge handover.
- Employee grievance, incident and disciplinary workflow with restricted access.
- Staff permissions based on job function, branch, operator and assigned account—not broad job titles alone.

## 7. Customer relationship and experience

- Customer profile and deduplicated identity references.
- Contact preferences, communication consent and opt-out history.
- Customer interaction timeline across permitted channels.
- Enquiries, complaints, support cases and escalation.
- Customer feedback, satisfaction and service recovery.
- Loyalty, rewards and customer retention.
- Warranty, repair, order and service history.
- Customer segmentation with documented purpose and privacy safeguards.
- Customer data export, correction and deletion/retention workflows where applicable.

## 8. Communications and contact centre

- Provider-neutral notification and message orchestration.
- Email, SMS, push, WhatsApp and voice channel adapters.
- Templates, localization, scheduling and approval.
- Delivery attempts, provider receipts, failure reasons and cost attribution.
- Conversation inbox, assignment, tags and service-level monitoring.
- IVR/call flows, call queue and human escalation through a carrier/SIP provider.
- Customer support knowledge suggestions and controlled AI response drafting.
- Consent, quiet hours, suppression lists and anti-abuse limits.
- Communications history with product- and purpose-based access.

The software orchestration can be Otya-owned; access to telecom and third-party messaging networks remains external.

## 9. Marketing, sales enablement and growth

- Brand, visual identity and approved content library.
- Campaign calendar, audience, channel, budget and approval.
- Promotion, coupon, referral and loyalty programme.
- Website/app content and publishing workflow.
- Lead capture, qualification, pipeline and follow-up.
- Sales target, conversion, campaign attribution and acquisition cost.
- Customer education, product announcements and release communication.
- Consent-aware marketing preferences and suppression.
- Market, competitor and customer research.

## 10. Product, project and innovation management

- Idea intake, research, problem statement and validation.
- Business case, expected outcomes, owner and budget.
- Requirements, acceptance criteria and architecture decision records.
- Product roadmap, milestones, dependencies and delivery status.
- UX research, design system and accessibility checks.
- Release notes, staged rollout, rollback and product support.
- Defect, feature request, incident and root-cause workflow.
- Experiment design, metrics, evaluation and approval.
- Intellectual-property register, code ownership and invention records.
- Product sunset, customer communication, data export and retention plan.

## 11. Engineering and developer experience

- Repository inventory, ownership, visibility and branch protection.
- Coding standards, architectural decision records and API contracts.
- Build/test/security CI pipelines and dependency update policy.
- Environment and configuration registry; no secrets in source control.
- API catalogue, versioning, schema and backward compatibility.
- Provider adapters and integration contract tests.
- Deployment manifests, approvals, rollout, rollback and release evidence.
- Error reporting, metrics, logs, traces and alert routing.
- Developer onboarding, local development and test fixtures.
- Software bill of materials, vulnerability response and patch management.
- Domain, DNS, certificate and route ownership.
- Infrastructure-as-code and drift detection where suitable.

## 12. Identity, security and privacy

- Human, service and AI-agent identity lifecycle.
- Authentication, MFA, passkeys, session management and account recovery.
- Product, tenant, branch, department, operator and resource-level authorization.
- Separation of duties and just-in-time privileged access.
- Secrets, keys, certificates and rotation schedules.
- Security events, audit records and anomaly alerts.
- Vulnerability management, threat modelling and security testing.
- Privacy notices, consent history, data subject requests and retention.
- Third-party risk, security questionnaire and incident notification tracking.
- Abuse prevention, bot controls, rate limits and suspicious activity review.
- Access reviews and offboarding access revocation.

## 13. Legal, regulatory and compliance operations

- Entity registration and statutory filing calendar.
- Licence, permit and renewal register by activity and jurisdiction.
- Regulatory obligation register with an accountable owner and evidence.
- Contracts, amendments, obligations, notices and renewal dates.
- Customer terms, privacy policies and versioned publication approval.
- Employment, supplier, partner and provider contract records.
- Intellectual-property and trademark portfolio.
- Consumer protection, complaints and disclosure obligations.
- Tax, data protection and payments/agency regulatory evidence.
- Legal hold, records retention and controlled document access.
- Compliance assessment and corrective-action plan.

The software supports compliance evidence and reminders; it does not itself grant a licence or replace qualified legal advice.

## 14. Risk, quality and trust

- Enterprise risk register, likelihood, impact and mitigation.
- Fraud typology, detection rules, review queue and case outcomes.
- Operational incidents, service degradation and post-incident review.
- Quality standards, inspection checklist and non-conformance.
- Root-cause analysis and corrective/preventive action.
- Vendor and concentration risk.
- Financial, cyber, privacy, physical and business-continuity risks.
- Control testing, evidence and exceptions.
- Fraud alerts with human review and appeal path.

## 15. Data, analytics and knowledge

- Authoritative data catalogue and system-of-record map.
- Data classification, retention, lineage and quality checks.
- Event taxonomy and versioned analytics definitions.
- Management dashboards and financial/operational reporting.
- Search over approved documents and knowledge bases.
- Company manuals, SOPs, playbooks and training content.
- Research library, source citations and evidence freshness.
- Forecasting, demand planning and anomaly detection.
- Data export, backup validation and migration testing.
- AI retrieval boundaries and product/department-specific knowledge spaces.

## 16. AI workforce and automation

- AI-agent registry, department, purpose and accountable human sponsor.
- Agent role, model/provider, allowed tools and data scope.
- Workflow orchestration, triggers, schedules and durable job state.
- Tool registry, schema validation and action policy.
- Human approval queues and dual-control requirements.
- Prompt/version registry, evaluations, test cases and regression checks.
- Agent memory boundaries, retention and deletion policy.
- Per-agent budget, rate, usage and provider cost controls.
- Prompt-injection and untrusted-content handling.
- Output provenance, action logs, exception and handover.
- Safe pause/disable and emergency revocation for agents.

## 17. Facilities, assets and physical operations

- Shop, office, storage location and branch register.
- Computers, phones, tablets, POS, routers and network equipment.
- SIM, number, handset, line purpose and operator inventory.
- Device custody, assignment, repair, warranty and return.
- Power, solar, battery, generator and internet backup.
- Physical access, keys, CCTV/security-system register and maintenance.
- Repairs, maintenance schedule and service-provider records.
- Cash-handling controls and secure storage procedures.
- Business continuity procedures for power, internet and device outages.

## 18. Continuity and resilience

- Critical-service register, owner and recovery priority.
- Backup schedule, encryption, retention and restore verification.
- Recovery objectives and documented restoration runbooks.
- Provider outage, network outage and account-lockout plans.
- Offline/manual operation and later controlled reconciliation.
- Domain, DNS and certificate recovery.
- Infrastructure migration and provider exit exercises.
- Incident communication and emergency contacts.
- Periodic disaster-recovery exercises and remediation tracking.

## Capability ownership record

Every implemented capability should be tracked with these fields in the private company register:

| Field | Meaning |
|---|---|
| Capability ID | Stable identifier |
| Domain / module | Accountable business area |
| Capability | Business outcome or operation |
| System of record | Authoritative data owner |
| Business owner | Person accountable for operation |
| Technical owner | Maintainer of the software |
| Data classification | Public, internal, confidential or restricted |
| Provider dependencies | External services required |
| Build/buy decision | Otya-built, open source, external or hybrid |
| Status | Discovered, designed, building, testing, live or retired |
| Acceptance evidence | Tests, approvals, runbooks and audit evidence |
