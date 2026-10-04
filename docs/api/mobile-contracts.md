# Mobile API contracts

The mobile clients use a small, text-first contract so catalog, consultation, checkout, and rider pages can work with limited data. All routes are same-origin under `/api`, matching `docs/api/openapi.yaml`.

## Authentication

Both Flutter apps authenticate directly against Supabase GoTrue and never receive a service-role key. `POST /auth/v1/otp` accepts a Kenyan phone number in local or E.164 format with `create_user` for registration, and `POST /auth/v1/verify` exchanges the code for an access token, refresh token, and user id. Sign-up metadata carries `full_name` and `phi_consent`; the database trigger records `phi_processing` consent only when `phi_consent` is `true`, so the client must set it only after the patient ticks the consent gate. The session is stored in platform secure storage, refreshed before expiry, and the app reads `GET /rest/v1/profiles` to confirm the role is `patient` (patient app) or `rider` with an active `riders` row (rider app) before showing any data.

## Catalog

`GET /api/catalog/products?q=&category=&county=` returns product id, display names, category, price in KES, stock state, prescription requirement, and trust metadata. Images are optional and may be skipped in low-data mode. Cart lines are identified by product slug so the server can price them.

## Checkout

`POST /api/checkout/orders` receives delivery phone, landmark, county, optional GPS, delivery method, and line items. `POST /api/mpesa/stk-push` receives the order id, order number, amount, and normalized Kenyan phone. Daraja posts the result to `POST /api/mpesa/callback`, and the client reads `GET /api/mpesa/status/{checkoutRequestId}` for a normalized state machine value.

Order reservation and pricing are server-side. The patient app calls the `create_order` database function with slugs and quantities and receives the authoritative subtotal, delivery fee, total, order id, and `AFY-YYYY-######` order number. Client-computed totals are never sent to M-PESA; the app pays the total returned by the server. Consent, stock, single-pharmacy, prescription, and county rules are enforced by the function and surfaced to the patient as a rejection message.

## Rider

`POST /dispatch/availability` takes `{isAvailable, lat, lng}`; the rider identity comes from the authenticated session, not the body, and the call is rejected when the rider licence has expired. `GET /dispatch/orders` lists the rider's assigned deliveries. `POST /dispatch/offers/{id}/accept` and `/dispatch/offers/{id}/decline` are idempotent. `POST /dispatch/deliveries/{id}/events` records arrived, picked_up, in_transit, failed, or delivered transitions. `POST /dispatch/orders/{id}/proof/photo` stores a base64-encoded image in the `PROOF_STORAGE_BUCKET` Supabase Storage bucket and returns the public URL. `POST /dispatch/deliveries/{id}/proof` requires that media reference, patient OTP verification, the recipient relationship, and a timestamped location result.

## Edge gateway rules

`workers/api-gateway` only forwards five prefixes: `/api/mpesa`, `/api/notifications`, `/api/ai-triage`, `/fhir`, and `/dispatch`. Everything else returns 404, so rider traffic must stay under `/dispatch`. Every `POST`, `PUT`, `PATCH`, and `DELETE` needs an `Idempotency-Key` header matching `^[A-Za-z0-9._:-]{8,128}$`; both clients generate one per request and reuse the stored key when replaying queued work. The gateway also forwards `Authorization` and requires a valid Supabase session for non-internal traffic.

`/dispatch` is authorized by path and method rather than by a single role list. Rider-scoped sessions are admitted on availability, order listing, offer accept and decline, delivery events, and both proof routes; pharmacy and admin sessions keep their existing access. Tokens with any other role are rejected with 403.

## Offline behaviour

Clients cache non-sensitive catalog data only. Clinical writes and payment actions are not replayed blindly; queued actions carry an idempotency key and are shown to the user until confirmed. Payment status polling never falls back to a synthetic success, and order history is read from the server rather than seeded locally.
