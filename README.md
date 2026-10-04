# AfyaCommerce

AfyaCommerce is a mobile-first Kenyan e-commerce clinic and pharmaceutical platform. The platform supports telehealth, FHIR R4 e-prescriptions, licensed pharmacy fulfilment, M-PESA payments, landmark-based delivery, and auditable clinical workflows.

## Repository layout

The root uses pnpm workspaces and Turborepo.

Shared packages:

- `@afyacommerce/types`: domain models, API contracts, Kenya phone, county, and KES utilities.
- `@afyacommerce/fhir-models`: typed HL7 FHIR R4 resource definitions and MedicationRequest helpers.
- `@afyacommerce/sdk`: authenticated, typed client for internal API resources and payment operations.
- `@afyacommerce/config`: shared TypeScript, ESLint rule, and Tailwind design-token presets.
- `@afyacommerce/ui`: React and Tailwind-compatible primitives using the AfyaCommerce design system.

Application surfaces:

- `apps/web`: Next.js App Router storefront, patient portal, pharmacy and provider consoles, and the server-side order and payment routes under `app/api`.
- `apps/mobile`: Flutter patient app (Supabase OTP auth, server-priced checkout, real M-PESA).
- `apps/rider`: Flutter rider app (Supabase OTP auth, dispatch offers, proof of delivery with camera and GPS).
- `workers/api-gateway`: Cloudflare Worker edge authorization, rate limiting, and upstream routing.
- `workers/mpesa`: M-PESA Daraja STK push, callback verification, and status normalization.
- `workers/fhir`, `workers/ai-triage`, `workers/notifications`: FHIR, triage, and messaging workers.
- `services/dispatch`: rider availability, job offers, and proof-of-delivery storage.
- `supabase`: schema, RLS policies, RPCs, migrations, and seed data.
- `infrastructure`: Terraform, Docker, and operational scripts.
- `docs`: API contracts, compliance notes, and runbooks.

## Requirements

- Node.js 20.11 or newer
- pnpm 9.15 or newer through Corepack
- A self-hosted Supabase and object storage deployment on Kenyan infrastructure for PHI
- Flutter 3.24 or newer for `apps/mobile` and `apps/rider`

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm validate:workspace
pnpm typecheck
pnpm lint
pnpm build
```

If pnpm is not available, `npm install` can install the root toolchain for local validation. Runtime services still require pnpm workspace support in CI.

Database:

```bash
supabase db push
psql "$SUPABASE_URL" -f supabase/seed.sql
```

## Environment and security

Keep `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, payment credentials, `DISPATCH_OTP_SECRET`, and integration client secrets server-side. Never expose them through `NEXT_PUBLIC_*` variables or browser bundles. PHI must be stored and processed on Kenyan infrastructure; Cloudflare R2 is reserved for non-PHI assets. The six-year audit retention requirement is represented by `AUDIT_LOG_RETENTION_DAYS=2190`.

The SDK accepts a user access-token provider and does not include service-role credentials. Database authorization is expected to remain enforced by Supabase Row Level Security, not by client checks.

The apps fail closed. The web middleware returns 503 in production when Supabase is unconfigured, dispatch OTP initialization throws instead of silently skipping, and the M-PESA routes return 503 when the backend base URL is missing. Order pricing, stock checks, consent gating, and order numbering are resolved by the `create_order` database function rather than by the client, and the M-PESA request must reference a UUID order id and an `AFY-YYYY-######` order number.

Patient consent is an affirmative act. `handle_new_auth_user` records `phi_processing` consent only when sign-up metadata carries `phi_consent: 'true'`, which the web and mobile registration forms set only after the patient ticks the consent gate. The `create_order` function refuses orders without active consent.

## Shared design tokens

The canonical CSS variables and a Tailwind-compatible token object live in `packages/ui/src/tokens.css` and `@afyacommerce/config`. The palette includes M-PESA green, clinical blue, urgency orange, semantic states, Inter typography, 44px minimum touch targets, and visible focus rings. The UI package exports the tokens so Next.js applications can import them from a global stylesheet.

## Validation

`pnpm validate:workspace` checks required foundation files, package metadata, and the core design-token contract. `pnpm check` runs lint and type checking across the workspace, while `pnpm build` produces package output in each package's `dist` directory. The Flutter apps are validated separately with `flutter analyze` and `flutter test` inside each app directory.
