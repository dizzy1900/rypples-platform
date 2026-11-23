-- Runtime tables written by the app (docs/04-data-model.md §10–§11).
-- The server uses the project admin key (bypasses RLS). RLS is enabled with no
-- anon/authenticated policies, so nothing is readable from a browser. When real
-- auth replaces the demo doors, add policies keyed on firm_id / company_id claims.

create table if not exists public.events (
  id text primary key,
  firm_id text not null default 'rypples',
  session_id text,
  actor text not null,
  type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null,
  at timestamptz not null default now()
);
create index if not exists events_session_at on public.events (session_id, at);
alter table public.events enable row level security;

-- Append-only: block UPDATE; allow DELETE only for the housekeeping sweep of old session rows.
create or replace function public.events_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'events is append-only';
end $$;
drop trigger if exists events_no_update on public.events;
create trigger events_no_update before update on public.events
  for each row execute function public.events_append_only();

create table if not exists public.agent_runs (
  id text primary key,
  firm_id text not null default 'rypples',
  flow text not null,
  input jsonb,
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  model text,
  prompt_version text,
  usage jsonb,
  searches integer not null default 0,
  fetches integer not null default 0,
  est_cost_usd numeric not null default 0,
  mode text not null,
  session_id text,
  ip_hash text,
  error text
);
create index if not exists agent_runs_started on public.agent_runs (started_at desc);
alter table public.agent_runs enable row level security;

create table if not exists public.any_company_runs (
  id text primary key,
  domain text not null unique,
  display_name text not null,
  status text not null,
  result jsonb not null,
  run_id text,
  created_at timestamptz not null default now()
);
alter table public.any_company_runs enable row level security;

create table if not exists public.captain_messages (
  id text primary key,
  session_id text not null,
  viewer_kind text not null,
  company_id text,
  role text not null,
  content jsonb not null,
  run_id text,
  created_at timestamptz not null default now()
);
create index if not exists captain_messages_thread on public.captain_messages (session_id, viewer_kind, company_id, created_at);
alter table public.captain_messages enable row level security;
