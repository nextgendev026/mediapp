# Incident response runbook

## Severity

| Level | Example | Response target |
|---|---|---|
| SEV-1 | Confirmed PHI exposure, destructive data loss, or unsafe dispensing | Immediate page and incident commander |
| SEV-2 | Payment duplication, widespread delivery failure, or unavailable clinical service | 15 minutes |
| SEV-3 | Limited user impact or degraded non-critical service | 4 hours |

## First response

1. Declare the incident in the approved incident channel.
2. Record start time, systems, reporter, and suspected data class.
3. Preserve logs, audit events, deployment identifiers, and relevant configuration without copying secrets.
4. Stop further exposure by disabling the affected path, rotating credentials, or taking the service read-only.
5. Assign an incident commander, security lead, clinical safety lead, and communications owner.
6. Notify the data protection officer and affected regulatory owners when the threshold is met.

## Containment

- Revoke sessions and API tokens for suspected account compromise.
- Restrict the database role to the minimum required access.
- Pause payment callbacks or dispatch consumers if integrity is uncertain.
- Quarantine suspicious rider accounts and delivery media.
- Keep the immutable audit stream available for investigation.

## Recovery

Validate the fix with a controlled test, restore from an encrypted backup when required, reconcile payments and dispenses, and document the root cause. Do not delete or edit audit rows during recovery.

## Closure

Complete a blameless review within five business days, record corrective actions with owners and dates, and update the DPIA and runbooks when a control changed.
