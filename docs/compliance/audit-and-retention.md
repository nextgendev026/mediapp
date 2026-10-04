# Audit and retention procedure

## Audit events

Every PHI read or write creates an append-only event containing:

- actor identifier and role
- action and resource type
- resource identifier
- PHI-access flag and purpose
- timestamp, request IP, and user agent
- non-secret request metadata

Clinical exports, dispenses, prescription status changes, rider custody updates, consent changes, and payment reconciliation are release-blocking audit event types.

## Retention

Set the operational retention period to 2190 days for the protected audit stream. Database backups follow the approved 30 daily, 12 monthly, and 7 yearly schedule. Clinical and financial retention must be confirmed against the current Kenyan legal schedule and PPB requirements before launch.

Deletion jobs must be append-only themselves and must never update or delete audit rows. A data-subject deletion request creates a request record, anonymises non-required identifiers, and records the outcome.

## Review

Operations reviews access anomalies daily, privileged-role changes weekly, and the complete audit control monthly. A failed review is escalated to the security lead and data protection officer.
