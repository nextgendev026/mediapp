-- Self-healing security system state.
-- Shared across Cloudflare isolates via Supabase so blocks/locks are enforced globally.

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  type text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  ip text,
  account_id text,
  detail jsonb not null default '{}'::jsonb,
  action_taken text
);

create table if not exists public.security_blocks (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  kind text not null check (kind in ('ip','account')),
  reason text not null,
  severity text not null,
  blocked_at timestamptz not null default now(),
  expires_at timestamptz,
  auto boolean not null default true,
  active boolean not null default true
);

create index if not exists security_events_at_idx on public.security_events (at desc);
create index if not exists security_events_ip_idx on public.security_events (ip);
create index if not exists security_events_account_idx on public.security_events (account_id);
create index if not exists security_blocks_target_idx on public.security_blocks (target) where active;
create index if not exists security_blocks_expires_idx on public.security_blocks (expires_at) where active;

alter table public.security_events enable row level security;
alter table public.security_blocks enable row level security;

grant usage on schema public to anon, authenticated, service_role;
