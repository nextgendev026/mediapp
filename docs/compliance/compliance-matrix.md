# Compliance evidence register

The following items are release gates. A checked item must link to an immutable evidence record in the controlled compliance repository.

| Requirement | Authority | Evidence | Owner | Status |
|---|---|---|---|---|
| Data controller registration | ODPC | Registration certificate | Admin | Pending |
| DHA notification | Digital Health Agency | Acknowledgement receipt | Admin | Pending |
| Signed DPIA | ODPC | Approved DPIA and review log | Compliance | Pending |
| Kenyan PHI hosting | DPA section 50 | VPS contract and network diagram | DevOps | Pending |
| Digital pharmacy licence | PPB | Licence and expiry record | Pharmacist | Pending |
| KMHFR facility ID | Ministry of Health | Facility registration | Pharmacist | Pending |
| Platform certification | Digital Health Agency | Certificate | Admin | Pending |
| Telemedicine registry | Digital Health Agency | Provider registry IDs | Clinical | Pending |
| FHIR R4 validation | DHA and HIE | Validator report | Engineering | Pending |
| Transport licences | PPB | Partner licence copies | Logistics | Pending |
| SHA empanelment | SHA | Empanelment confirmation | Admin | Pending |
| Six-year audit retention | PPB | `AUDIT_LOG_RETENTION_DAYS=2190` evidence | Engineering | Pending |
| Staff MFA | Internal policy | Auth configuration export | Security | Pending |
| Quarterly penetration test | Internal policy | Test report | Security | Pending |

## Evidence handling

- Store evidence in the approved Kenyan compliance repository.
- Record the evidence hash, owner, collection date, and expiry date.
- Restrict access by role and log every evidence download.
- Do not place credentials, private keys, or production exports in this repository.
- Recheck expiring licences at least 60 days before renewal.
