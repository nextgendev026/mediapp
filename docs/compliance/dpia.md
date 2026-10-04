# AfyaCommerce DPIA

## Scope

This assessment covers the patient Flutter app, rider Flutter app, self-hosted Supabase data plane, MinIO, payment and notification gateways, dispatch workflows, and support operations. It is a working template and requires review by the appointed data protection officer, clinical safety lead, and Kenyan legal counsel before launch.

## Data inventory

| Data | Classification | Primary location | Purpose | Retention |
|---|---|---|---|---|
| Patient profile and contact details | Personal | Kenyan VPS | Authentication and service delivery | Account life plus legal schedule |
| Consultation notes and prescriptions | Health | Kenyan VPS and MinIO | Treatment and dispensing | Applicable clinical and PPB schedule |
| Orders and delivery landmarks | Personal and sensitive | Kenyan VPS | Fulfilment, payment, support | Six years where audit applies |
| Payment references | Financial | Kenyan VPS and PSP | Reconciliation and refunds | Finance schedule |
| Rider location trail | Personal and sensitive | Kenyan VPS | Dispatch and chain of custody | Short operational period plus audit evidence |
| Product catalog and public assets | Non-PHI | Edge or R2 | Commerce | Publication schedule |
| Audit events | Sensitive | Kenyan PostgreSQL | Security, PPB and accountability | 2190 days |

## Flows

1. The mobile app sends credentials and requests over TLS to the Kenyan API boundary.
2. Supabase Auth verifies the phone OTP and stores session material in platform secure storage.
3. Clinical and pharmacy records are written to the self-hosted data plane. Service-role credentials remain server-side.
4. Payment initiation sends only the checkout amount, order reference, and Kenyan phone number to the payment gateway. The gateway callback updates the unified transaction record.
5. Dispatch receives the minimum order, pharmacy, rider, and landmark data needed for delivery.
6. Notifications contain order references and delivery instructions, not clinical details.
7. Audit events record actor, role, action, resource, purpose, timestamp, and request metadata.

## Risks and controls

| Risk | Impact | Controls | Owner |
|---|---|---|---|
| Unauthorized PHI access | Severe | RLS, MFA, Zero Trust, least-privilege service roles, immutable audit log | Engineering |
| Data leaves Kenya | Severe | Kenyan VPS for PHI, edge routing restricted to network and non-PHI assets | DevOps |
| Payment replay or duplicate callback | High | Idempotency key, callback state machine, reconciliation job | Payments |
| Lost or damaged shipment | High | Chain-of-custody timestamps, photo and OTP proof, transport licence checks | Logistics |
| Medication dispensed against an invalid prescription | Severe | Pharmacist approval state, allergy checks, prescription audit | Pharmacy |
| Lost device exposes session | High | Platform secure storage, short sessions, remote revocation | Mobile |
| Weak consent evidence | High | Versioned consent records, timestamps, revocation workflow | Compliance |
| Ransomware or destructive change | Severe | Encrypted backups, restore drills, immutable audit, MFA | DevOps |

## Mitigation decisions

- Cloudflare Workers are treated as a network and payment gateway layer, not a clinical system of record.
- R2 is not used for PHI. Prescription files remain in MinIO on Kenyan infrastructure.
- USSD and SMS messages avoid diagnoses, medication names, and other unnecessary clinical detail.
- Account deletion anonymises profile data where possible while preserving records required by law.
- No production launch is permitted until the evidence register contains the registrations and licences listed in the compliance matrix.

## Consultation and approval

| Role | Name | Decision | Date |
|---|---|---|---|
| Data protection officer |  | Pending |  |
| Clinical safety lead |  | Pending |  |
| Security lead |  | Pending |  |
| Data controller representative |  | Pending |  |
