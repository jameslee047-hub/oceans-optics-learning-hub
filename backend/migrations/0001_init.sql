-- Learning Hub Phase 2 -- initial schema.
--
-- Zero-PII by design: learning_users stores nothing but the Shopify
-- customer ID. Display name/email are always read live from the Shopify
-- session and never persisted here. Do not add email/name/address/phone
-- columns to this table without a documented, separately-approved reason.
--
-- Not created here (explicitly deferred): achievements, certificates.
--
-- Accessed ONLY via this backend's service-role key -- Row Level Security
-- is intentionally NOT relied on as the access boundary (see Phase A
-- report, "Supabase Security"): every query the backend issues is already
-- scoped by a shopify_customer_id derived from a verified session token.
-- RLS is still enabled below as defense-in-depth in case the anon/public
-- key is ever accidentally exposed; its default-deny policy means an
-- unauthenticated Supabase client can do nothing regardless.

create extension if not exists pgcrypto;

create table learning_users (
  id uuid primary key default gen_random_uuid(),
  shopify_customer_id bigint not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table lesson_progress (
  user_id uuid not null references learning_users(id) on delete cascade,
  lesson_id text not null,
  first_viewed_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, lesson_id),
  constraint lesson_id_format check (lesson_id ~ '^R[0-9]{2}$')
);

create index lesson_progress_user_id_idx on lesson_progress(user_id);

create table knowledge_check_results (
  user_id uuid not null references learning_users(id) on delete cascade,
  lesson_id text not null,
  score integer not null,
  total integer not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id),
  constraint lesson_id_format check (lesson_id ~ '^R[0-9]{2}$'),
  constraint score_non_negative check (score >= 0),
  constraint total_positive check (total > 0),
  constraint score_within_total check (score <= total)
);

create index knowledge_check_results_user_id_idx on knowledge_check_results(user_id);

alter table learning_users enable row level security;
alter table lesson_progress enable row level security;
alter table knowledge_check_results enable row level security;

-- No policies are created. RLS is kept on with zero policies as
-- defense-in-depth: service_role has BYPASSRLS (a role attribute Supabase
-- sets up by default), so it is unaffected either way, but a zero-policy
-- table denies every other role regardless of what it's granted below.

-- This project has "Automatically expose new tables" DISABLED, so -- unlike
-- a default Supabase project -- Supabase does NOT run its usual
-- `alter default privileges ... grant ... to anon, authenticated, service_role`
-- for tables created here. That means service_role has NO access to these
-- tables until explicitly granted, not even though it bypasses RLS:
-- BYPASSRLS only skips row-level POLICIES, it does not substitute for the
-- underlying object-level GRANT Postgres still requires. Without the grants
-- below, the Vercel backend's service-role client would fail every query
-- with "permission denied for table ...".
grant usage on schema public to service_role;

grant select, insert, update, delete on table learning_users to service_role;
grant select, insert, update, delete on table lesson_progress to service_role;
grant select, insert, update, delete on table knowledge_check_results to service_role;

-- Sequences: none needed. Every primary key here is either `uuid default
-- gen_random_uuid()` or a composite key (user_id, lesson_id) -- none of
-- these tables owns a serial/bigserial/identity column, so there is no
-- sequence for service_role to need USAGE/SELECT on.
--
-- Functions: none needed. gen_random_uuid() (from the pgcrypto extension
-- enabled above) is EXECUTE-granted to PUBLIC by default when the
-- extension is created, which already includes service_role; pgcrypto
-- does not revoke that default, so no explicit function grant is required.

-- Explicit, self-documenting denial for anon/authenticated. Functionally a
-- no-op given "Automatically expose new tables" is disabled -- they were
-- never granted anything on these tables to begin with -- but stated
-- outright so this file itself is the proof of intent (these roles get
-- zero table access to Learning Hub data) rather than relying on a project
-- dashboard setting someone reading this migration later has no way to see.
revoke all on table learning_users from anon, authenticated;
revoke all on table lesson_progress from anon, authenticated;
revoke all on table knowledge_check_results from anon, authenticated;
