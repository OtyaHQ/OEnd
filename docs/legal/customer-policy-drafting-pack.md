# Otya customer policies — drafting pack

**DRAFT — NOT FOR PUBLICATION OR CUSTOMER ACCEPTANCE**

Prepared: 10 November 2026. The current public /terms and /privacy pages are versioned 2 September 2026 and are primarily app-focused. This draft describes additional terms needed before OtyaPoint offers retail, agency and bill-payment services. A Ugandan advocate and the actual licensed service principals must review and approve it before the text is published or a legal version is activated.

## A. General Terms of Service — proposed content

### 1. Operator identity
The final document must name the registered legal entity that sells the goods or provides each service, its registration details, physical address, official email/phone and complaint escalation channel. Do not publish Otya Holdings Limited as an already registered company until registration is complete. Where different entities operate different products, identify the operator for that product at checkout, in the receipt and in the agreement.

### 2. Products and prices
Display the product name, condition (new/used/refurbished), key specifications, stock availability, total price and applicable taxes before the customer commits. Prices and promotions must not be misleading. A sales record must identify the item, quantity, price, payment method and receipt/reference number.

### 3. Orders and payment
Explain when an order is accepted, when title/risk passes, what happens if stock is unavailable, whether a deposit is refundable, how a payment is confirmed and how a receipt is issued. Never treat a pending provider response as a successful payment. Do not request a customer PIN, OTP, full card number or provider password.

### 4. Digital and third-party services
For airtime, data, bill payments, mobile money and other provider services, identify the actual provider/principal, the service being purchased, the amount, any disclosed fee, reference, expected completion and the provider's dispute/reversal rules. State clearly whether the shop acts as an authorised agent/merchant under a written agreement. Do not imply the Otya software itself is the issuer of electronic money or a licensed payment service provider.

### 5. Returns, refunds and warranties
Publish a separate Returns, Refunds and Warranty Policy. It must distinguish:
- physical goods that are defective, damaged, incorrect or materially misdescribed;
- change-of-mind requests, where permitted by law and the disclosed policy;
- manufacturer and shop warranties, with the responsible warranty provider and duration;
- cancelled or failed digital/provider transactions, where the provider's confirmation and reversal process controls;
- remedies, evidence, timelines and complaint escalation.

Do not use a blanket “no refunds under any circumstances” clause. Fill in the approved inspection/return window, exclusions, transport responsibility and warranty steps after legal review and after checking supplier agreements.

### 6. Acceptable use
Customers must not use the service for fraud, impersonation, money laundering, sanctions evasion, unauthorised access, harassment, unlawful content, intellectual-property infringement or attempts to bypass security and transaction controls. Suspicious financial activity must be escalated under the applicable principal/provider procedures and law.

### 7. Availability and transaction status
The service may be interrupted by telecom, network, power, bank, provider or Cloudflare outages. Show transaction states accurately: DRAFT, SUBMITTED, PENDING, SUCCESS, FAILED, REVERSED or UNKNOWN as appropriate. Re-query uncertain transactions and reconcile them; never automatically retry a money-moving request unless the provider contract and idempotency controls make that retry safe.

### 8. Complaints and disputes
Name the first-line support contact, minimum information required (receipt/reference, date, amount and provider), escalation route to the licensed principal, and any regulator contact required by the principal. Do not publish an invented response deadline or regulator escalation pathway.

### 9. Governing law and mandatory rights
Ugandan law applies where legally appropriate. No term may remove a consumer's non-waivable statutory rights. Liability and dispute clauses require review by a Ugandan advocate.

## B. Privacy Notice — minimum required content

### Controller and contact
Name the actual data controller and its contact details, identify any data protection officer/privacy lead, and provide a dedicated request channel. The legal operator must confirm these details before publication.

### Data categories
Document only what each feature actually needs:
- account identity, names, email/phone and linked login identity;
- retail order, product, stock, receipt and support records;
- payment/agency provider references, amounts, agent/outlet IDs, status, cash/float and reconciliation records;
- device/app diagnostics, security logs and fraud-prevention signals;
- support messages, attachments and feedback;
- consent, policy version, timestamp and marketing preference;
- cookies and optional analytics identifiers.

Never collect or store customer PINs, OTPs, passwords, card verification values or reusable provider credentials.

### Purposes and lawful grounds
Map each purpose to its actual lawful basis: account/service performance, legal obligation, legitimate interests with an assessment where applicable, or separate opt-in consent for optional marketing. Do not use a single blanket consent to cover all purposes.

### Recipients and international processing
List Cloudflare, Resend, GitHub, Google/Firebase, Telegram and payment providers only for the functions they actually perform. Distinguish a processor acting under Otya's instructions from an independent controller. Identify relevant countries/locations and confirm applicable transfer safeguards before data is sent outside Uganda.

### Retention
Create an approved schedule per record class (identity, payment ledger, receipt, audit, support, diagnostics, marketing and security). Financial/tax/AML, dispute and legal-hold requirements may override deletion requests for the required period. Do not promise immediate deletion of records that must lawfully be retained.

### Individual rights and requests
Provide a process for identity-checked access, correction, deletion, objection, restriction and withdrawal requests as applicable under Ugandan law. Track the request, verify the requester, record the decision, and explain any lawful refusal or retention.

### Security and breach response
Explain that reasonable technical and organisational controls are used; do not promise perfect security. Internally, maintain incident severity, containment, evidence preservation, impact assessment, regulator escalation, affected-person communication where required, and post-incident review.

### Cookies, analytics and marketing
Describe necessary session/security cookies separately from optional analytics/marketing. Give users a clear choice where consent is required. Keep marketing consent separate from service terms, unbundled, default-off and revocable.

## C. Payment and Agent-Service Disclosure — proposed per transaction

Before accepting cash or a digital payment, show:
1. the licensed bank/payment provider/e-money issuer whose service is being used;
2. the OtyaPoint outlet's exact authorised role and agent identifier where applicable;
3. the service type and customer identifier (masked where possible);
4. amount, currency, provider charge and Otya/service fee separately;
5. transaction limits and any prerequisites;
6. confirmation/reference and what pending, success, failed and reversed mean;
7. expected processing time only where the provider publishes or contractually confirms it;
8. complaint, failed-transaction and reversal contact;
9. a receipt with the provider's reference, not just an internal Otya request ID.

A user must not be charged twice for an uncertain transaction. The system must first query/reconcile the original provider reference.

## D. Pre-publication decisions still required

- [ ] Confirm registered legal operator and business registration details.
- [ ] Confirm PDPO registration certificate, controller/processor classification and privacy officer.
- [ ] Confirm licensed principal and signed agent/merchant contract for every financial product.
- [ ] Confirm service fees, transaction limits, settlement, float, cash custody and reversal rules in writing.
- [ ] Confirm tax, VAT, TIN and EFRIS classification with URA/qualified accountant.
- [ ] Confirm product warranty sources, return windows and supplier terms.
- [ ] Complete data inventory, processor contracts, international transfer review and retention schedule.
- [ ] Legal review and approval by a Ugandan advocate.
- [ ] Publish each approved policy with a version, effective date, content hash and accessible URL.
- [ ] Only then update TERMS_VERSION / PRIVACY_VERSION and require fresh acceptance from existing signed-in users.

## E. Provider integration boundary

Interswitch's current public Quickteller Bills Payment v5 guide describes categories, billers, payment items, customer validation, payment and transaction enquiry, and gives QA and production base URLs. It also documents an Interswitch merchant account, Terminal ID, credentials and virtual-card settlement prerequisites. That guide's amount examples are in NGN/kobo; it does not, by itself, prove that a particular Uganda merchant profile, UGX biller set, terminal or production service is enabled. Obtain written Uganda-specific confirmation and merchant-specific documentation before implementation or launch.

Quickteller Business merchant products, Interswitch Bills Payment v5 and Interswitch's other acquiring/agency APIs must be modelled as separate integrations and contracts. Do not infer that access to one grants access to the others.
