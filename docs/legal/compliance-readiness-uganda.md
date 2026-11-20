# Uganda compliance readiness for Otya

Status: working checklist — not legal advice and not approval to start a regulated activity.

Last reviewed: 10 November 2026.

## 1. Confirm who legally operates each service

Before publishing final legal terms, record the exact registered legal name, registration number, registered address, tax identification details, and official contact details of the entity that contracts with customers. A brand name is not a substitute for the legal operator. Do not publish an unregistered company as though it already exists.

The public-facing Otya name can remain the product brand. The footer, receipts, invoices, contracts, privacy notice and customer support workflow must identify the actual legal operator for each transaction.

## 2. Personal-data protection

Uganda's Data Protection and Privacy Act, Cap. 97 and Data Protection and Privacy Regulations, 2021 apply to collection and processing of personal data. The PDPO says organisations collecting personal data must register and obtain a certificate before processing, and provides a register search and breach-reporting channel.

Actions:
- Determine whether the operating entity is a data controller, data processor, or both for each Otya service.
- Register the appropriate entity/classification with the Personal Data Protection Office (PDPO); retain the certificate and renewal date.
- Appoint and publish a responsible privacy contact / data protection officer where required.
- Maintain a record of processing activities: data categories, purposes, lawful basis, systems, recipients, retention, locations and security controls.
- Map where data is stored and accessed. Review international transfers and processor/subprocessor terms for Cloudflare, Resend, GitHub, Google/Firebase, Telegram, Interswitch and any other provider.
- Put processor agreements and access controls in place. Do not send payment secrets, authentication tokens or unnecessary customer identifiers to analytics or AI prompts.
- Implement requests for access, correction, deletion, objection and other rights that apply under the Act.
- Maintain a breach-response process, incident log and PDPO escalation path. The PDPO website states that organisations must report breaches that may compromise personal data immediately.
- Submit the PDPO annual compliance report for each applicable financial year if the entity is registered and within scope. Regulation 50 sets a 90-day rule after the applicable financial year end, and PDPO guidance describes the Government financial year as 1 July–30 June; for a year ending 30 June 2026, that calculation points to 28 September 2026. Separately, the PDPO Knowledge Center published a public notice setting 23 November 2026 as the submission deadline for the 2025/2026 annual compliance report. Because the notice date and the general 90-day calculation appear different, an in-scope registered controller/processor/collector should contact PDPO immediately for written clarification, prepare the report now, and follow the published 23 November notice unless PDPO gives a different written instruction.

## 3. Payments and agency services

The National Payment Systems Act, 2020 prohibits a person from offering payment services, operating a payment system or issuing payment instruments without the required Bank of Uganda licence, subject to the statutory exceptions. Bank of Uganda licenses and supervises payment service providers and system operators. The National Payment Systems (Agents) Regulations, 2021 govern agents.

Before enabling any cash-in, cash-out, mobile-money, wallet, bill-payment or settlement operation:
- Obtain the exact written appointment/agency agreement from the relevant Bank of Uganda-licensed bank, payment service provider or electronic-money issuer.
- Confirm that the exact agent outlet, products, channels, staff, fees, transaction limits, liquidity and service territory are covered by that agreement and any required approvals.
- Confirm KYC/C DD, sanctions/AML, suspicious-transaction escalation, agent training, safeguarding, customer complaints, liquidity/float management, daily reconciliation and record retention obligations with the principal.
- Clearly disclose the principal/provider, the agent's role, customer fees, limits, service availability, expected completion, reversal/refund path and complaint contacts.
- Keep provider money separate from shop cash and inventory accounting. Never represent an internally created draft or pending request as completed provider value.
- Keep all live provider actions disabled until production credentials, terminal/merchant identifiers, written approval, signed agreement, settlement arrangements and reconciliation are independently verified.

OtyaPoint must operate as an agent/merchant technology layer only within the permissions and contracts actually held. Do not describe Otya Holdings/OtyaPoint as a bank, e-money issuer, payment system operator or licensed PSP unless the relevant licence has been granted.

## 4. Retail, refunds, receipts and EFRIS

For phones, accessories and electronics, publish a practical customer policy covering:
- accurate product descriptions, prices, taxes and any warranty supplied by the manufacturer or shop;
- proof of purchase and receipt details;
- defective, damaged, incorrect or misdescribed goods;
- inspection and return windows, exclusions only where lawful, repair/replacement/refund options and who pays return transport;
- warranty provider, duration, process and limits;
- cancellations and refunds for digital services or bill payments, where the provider's state and reversal rules control;
- a documented complaint escalation contact and response process.

Do not promise a blanket "no refunds" rule. Have a Ugandan lawyer review the final wording against applicable consumer and sale-of-goods law and the provider contracts.

EFRIS is not a tax. URA says it is mandatory for VAT-registered taxpayers and designated sectors, and it publishes sector and small-business turnover rules. Confirm Otya's actual TIN/VAT status, sector classification, turnover and any exemption directly with URA/accountant before deciding whether to integrate mandatory EFRIS or use voluntary e-receipts.

## 5. Website, app and account policies

The existing public Terms and Privacy pages are app-centric. Before adding retail/agency functionality to the same account or website, create and cross-link:
- General Terms of Service and product-specific terms.
- Privacy Notice with controller identity, data purposes, lawful bases, recipients, retention, transfers and user rights.
- Cookies / analytics notice and consent controls where required.
- Acceptable Use and Security Rules.
- Retail Returns, Refunds and Warranty Policy.
- Payment / Bill-Payment and Reversal Policy.
- Mobile-Money / Agent-Service Disclosure and Complaints Procedure.
- Support and account-deletion / data-request procedure.
- Provider-specific notices when Interswitch, Quickteller, Airtel, MTN or another principal processes the transaction.

Marketing consent must remain separate from service terms, optional, unbundled and revocable. Do not pre-check it.

## 6. Minimum backend controls

- Keep a versioned policy registry (policy type, version, effective date, URL, content hash, approval state).
- Record append-only consent events: user, policy type/version, action, timestamp and source. Do not treat marketing consent as a condition of account creation.
- Require acceptance of the currently effective Terms and Privacy versions when those documents materially change, while preserving the old acceptance history.
- Provide authenticated data access/correction/deletion request intake and a human review queue. Apply retention/legal-hold rules before deletion.
- Keep a data-processing inventory and a processor/vendor register.
- Add request IDs, idempotency, audit events, dispute states, provider reference, callback signature verification and independent reconciliation to all payment workflows.
- Maintain backup verification and restoration evidence for each database, not just a successful export.

## Official references

Official references:
- PDPO, Data Protection and Privacy Regulations, 2021 (Regulation 50): registered data collectors, processors and controllers submit a summary within 90 days after each financial year ends: https://pdpo.go.ug/media/2022/03/Data_Protection_and_Privacy_Regulations-2021.pdf
- PDPO Annual Compliance Report Template: identifies the Government financial year as 1 July–30 June: https://pdpo.go.ug/media/2024/01/Data-Controller-Processor-Annual-Compliance-Report-Template.pdf

- Uganda Data Protection and Privacy Act, Cap. 97: https://ulii.org/en/akn/ug/act/2019/9/eng%402023-12-31
- Data Protection and Privacy Regulations, 2021: https://ulii.org/en/akn/ug/act/si/2021/21/eng%402021-03-12
- PDPO Uganda: https://pdpo.go.ug/
- PDPO Knowledge Center (including current annual-report notice): https://pdpo.go.ug/knowledge-center
- National Payment Systems Act, Cap. 59: https://ulii.org/en/akn/ug/act/2020/15/eng%402023-12-31
- National Payment Systems (Agents) Regulations, 2021: https://ulii.org/en/akn/ug/act/si/2021/19/eng%402021-03-05
- Bank of Uganda — financial infrastructure and innovation: https://bou.or.ug/financial_infrastructure_innovation
- URA EFRIS guidance: https://ura.go.ug/en/efris/
- URA additional EFRIS taxpayer notice (11 August 2026): https://ura.go.ug/en/additional-taxpayers-required-to-use-efris/

## Release blockers to clear with the owner / qualified Ugandan adviser

1. Confirm the legal operator's registered name and business details for OtyaPoint.
2. Confirm PDPO registration status, classification and responsible officer.
3. Confirm the exact licensed principal(s), signed agency agreements, approval scope and terminal/merchant credentials.
4. Confirm tax/VAT/EFRIS position with URA or a qualified accountant.
5. Approve the public-facing policy text and warranty/returns rules with a Ugandan lawyer.
