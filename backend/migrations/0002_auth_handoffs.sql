-- Learning Hub Phase B, Checkpoint 1 -- one-time OAuth-to-storefront handoff.
--
-- Bridges the Customer Account OAuth callback (a server-to-server redirect;
-- Shopify strips Set-Cookie from App Proxy responses, and the Learning
-- Progress JWT must never appear in a URL/query string/fragment) to the
-- storefront bootstrap script, which exchanges this opaque, single-use code
-- for the existing short-lived Learning Progress JWT via
-- POST /api/customer-auth/exchange. See lib/auth-handoff.js.
--
-- Only the SHA-256 hash of the code is ever stored. Losing this table's
-- contents does not expose any usable credential: the hash cannot be
-- reversed to the raw code, and every row is useless after 2 minutes or one
-- consumption, whichever comes first.
--
-- Additive only: does not modify 0001_init.sql. user_id is
-- learning_users.id, the pre-existing internal uuid keyed off the numeric
-- Shopify customer ID -- this does NOT resurrect the abandoned
-- OIDC-subject identity model; nothing OIDC-derived is stored here.

create table learning_auth_handoffs (
  code_hash text primary key,
  user_id uuid not null references learning_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

-- Supports per-user handoff lookups (e.g. a future cleanup/audit job); the
-- consume path itself is keyed directly by the code_hash primary key and
-- needs no index beyond that.
create index learning_auth_handoffs_user_id_idx on learning_auth_handoffs(user_id);

alter table learning_auth_handoffs enable row level security;

-- No policies, matching 0001_init.sql's pattern: service_role bypasses RLS
-- entirely (BYPASSRLS), and a zero-policy table denies every other role
-- regardless of what it is granted below.

grant select, insert, update, delete on table learning_auth_handoffs to service_role;

revoke all on table learning_auth_handoffs from anon, authenticated;

-- Atomic one-time consumption. A plain "SELECT unused row" followed by a
-- separate "UPDATE ... SET consumed_at" would be two independent round
-- trips with a race window: two simultaneous exchanges of the same code
-- could both see consumed_at IS NULL before either write lands, and both
-- would then mint a Learning Progress session for the same handoff. This
-- function collapses that into a single UPDATE ... WHERE ... RETURNING:
-- Postgres locks the matched row for the duration of the UPDATE, so a
-- second concurrent call targeting the same row blocks until the first
-- transaction commits, then re-evaluates the WHERE clause against the
-- now-consumed row and matches zero rows. Only one caller can ever receive
-- a non-empty result for a given code.
create or replace function consume_learning_auth_handoff(p_code_hash text)
returns table (shopify_customer_id bigint)
language plpgsql
as $$
declare
  v_user_id uuid;
begin
  update learning_auth_handoffs
  set consumed_at = now()
  where learning_auth_handoffs.code_hash = p_code_hash
    and learning_auth_handoffs.consumed_at is null
    and learning_auth_handoffs.expires_at > now()
  returning learning_auth_handoffs.user_id into v_user_id;

  if v_user_id is null then
    return;
  end if;

  return query
    select learning_users.shopify_customer_id
    from learning_users
    where learning_users.id = v_user_id;
end;
$$;

-- Postgres grants EXECUTE on newly created functions to PUBLIC by default
-- (unlike tables, which this project's "Automatically expose new tables"
-- setting already keeps locked down) -- explicitly revoke that here so
-- PostgREST cannot let the anon/authenticated API keys call this function
-- directly and brute-force code hashes outside our backend's
-- origin-restricted, format-validated exchange endpoint.
revoke all on function consume_learning_auth_handoff(text) from public;
grant execute on function consume_learning_auth_handoff(text) to service_role;
