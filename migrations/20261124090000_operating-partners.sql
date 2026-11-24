-- Operating partners as a funnel, open-ended partner types, and Growth Readiness per company.
-- Forward-only. partner_recruiting is no longer read: its rows are now operators at an earlier stage.

alter table public."operators" alter column "rating" drop not null;
alter table public."operators" add column if not exists "stage" text not null default 'active';
alter table public."operators" add column if not exists "what" text;
alter table public."operators" add column if not exists "tools" jsonb not null default '[]'::jsonb;
alter table public."operators" add column if not exists "onboarding_done" jsonb not null default '[]'::jsonb;
alter table public."operators" add column if not exists "engagement" text;
alter table public."operators" add column if not exists "for_deal_id" text;
alter table public."operators" add column if not exists "stage_note" text;

create table if not exists public."partner_types" (
  "id" text primary key,
  "label" text not null,
  "group" text not null,
  "what" text not null,
  "sort" integer not null,
  "provenance" text not null,
  "firm_id" text not null default 'rypples',
  "created_at" timestamptz not null default now()
);
alter table public."partner_types" enable row level security;

alter table public."readiness_modules" add column if not exists "operator_id" text;
alter table public."readiness_modules" add column if not exists "program_id" text;
alter table public."readiness_modules" add column if not exists "focus" text not null default '';
update public."readiness_modules" set "focus" = case "id" when 'rm-01' then 'Buyers' when 'rm-02' then 'Pricing' when 'rm-03' then 'Contracts' when 'rm-04' then 'Hiring' when 'rm-05' then 'Reporting' else "focus" end;

create table if not exists public."readiness_plans" (
  "id" text primary key,
  "company_id" text not null,
  "module_id" text not null,
  "status" text not null,
  "output" text,
  "note" text,
  "provenance" text not null,
  "firm_id" text not null default 'rypples',
  "created_at" timestamptz not null default now()
);
alter table public."readiness_plans" enable row level security;
