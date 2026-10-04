# Payment and dispatch outage runbook

## M-PESA

1. Confirm the status endpoint and callback consumer health.
2. Compare checkout request IDs with internal payment transactions.
3. Keep orders pending when status is unknown; never mark an order paid from a client-side success message.
4. Re-run reconciliation from provider reports and the internal transaction ledger.
5. Notify support with a status page message and an expected update time.

## Dispatch

1. Stop assigning riders if the dispatch consumer or location channel is unavailable.
2. Keep paid orders queued and preserve the payment state.
3. Notify pharmacies and patients that delivery is delayed.
4. Resume offers only after rider identity, licence, and location checks are healthy.
5. Reconcile every affected order against chain-of-custody events.

## Recovery criteria

- Payment callbacks are idempotent and terminal states are consistent.
- No order is dispatched without a valid transport licence and pickup record.
- Proof of delivery requires photo, OTP, and a GPS stamp where available.
