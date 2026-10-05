-- Cloudflare Pages persistence for the demo/dev data store.
-- The web app keeps its single-document store model; on Cloudflare Pages the
-- document is persisted here via the Supabase REST API (service role) instead
-- of the ephemeral filesystem. Production should migrate to the dedicated tables.
create table if not exists public.pages_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.pages_state enable row level security;

grant usage on schema public to anon, authenticated, service_role;
