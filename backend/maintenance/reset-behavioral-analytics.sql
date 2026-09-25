-- ============================================================================
-- SAFE ANALYTICS RESET -- Learning Hub behavioural event history
-- ============================================================================
--
-- PURPOSE
--   Delete Preview/dev-testing-contaminated behavioural analytics history so
--   production analytics start from a clean, trustworthy baseline. See the
--   project report ("Learning Hub analytics contamination audit") for the
--   full investigation: the theme's tracking script
--   (theme/learning-hub-pilot/assets/learning-hub-progress-tracking.js)
--   hardcodes the single production Vercel backend origin with no
--   environment distinction, so any developer/QA testing of Learning Hub
--   pages, lessons, quizzes, or anonymous tracking -- on the live storefront
--   domain, via an unpublished-theme preview on that same domain, or from a
--   fresh incognito/private browser context -- wrote directly into this same
--   production table. That gap is now closed in code (see
--   backend/lib/analytics-policy.js), but it does not undo history already
--   recorded before the fix shipped -- hence this one-time reset.
--
-- WHAT THIS TOUCHES
--   Exactly one table: learning_events. This is the ONLY behavioural
--   analytics table in this schema (backend/migrations/0004_learning_events.sql,
--   0005_anonymous_learning_events.sql) -- there is no other event/history
--   table anywhere in this project.
--
-- WHAT THIS NEVER TOUCHES (and this script contains no statement that could)
--   - learning_users               (authenticated learner identity/accounts)
--   - lesson_progress              (saved lesson view/completion STATE)
--   - knowledge_check_results      (saved Knowledge Check scores/answers)
--   - learning_auth_handoffs       (short-lived OAuth handoff codes)
--   - any Shopify customer id, name, email, or other identity/account data
--     (none of that is ever stored in this database at all -- see
--     backend/migrations/0001_init.sql's header comment)
--
-- SEQUENCES / MATERIALIZED VIEWS / CACHES
--   None to refresh. learning_events.id is `uuid default gen_random_uuid()`,
--   not a serial/bigserial/identity column, so there is no sequence whose
--   next value depends on existing rows. No materialized view exists
--   anywhere in this schema (grep backend/migrations/*.sql -- none defined).
--   PostgREST/Supabase does not cache row data server-side in any way this
--   deletion would need to invalidate.
--
-- HOW TO USE THIS FILE (Supabase SQL Editor)
--   1. Run SECTION 1 (read-only) first, by itself. Review the counts.
--   2. Only if the counts look like what you expect to delete, run SECTION 2
--      up to and including the post-delete count SELECT, but stop BEFORE
--      typing/running the final COMMIT -- inspect the "after" counts in that
--      same editor session.
--   3. If everything looks correct, run `COMMIT;` to make it permanent.
--      If anything looks wrong, run `ROLLBACK;` instead -- nothing will have
--      changed. (Supabase's SQL Editor keeps one open transaction across
--      statements you run sequentially in the same tab/session, exactly
--      like a psql session -- do not open a new query tab partway through,
--      that starts a new connection/transaction.)
--
-- This script does not run automatically as part of any deploy, migration,
-- or CI step. It is a manual, human-run, one-time maintenance action.
-- ============================================================================


-- ============================================================================
-- SECTION 1 -- READ-ONLY AUDIT (run this first, on its own, no transaction
-- needed -- these are plain SELECTs, nothing here can change any data)
-- ============================================================================

-- Total behavioural analytics rows, and the only table they live in.
select count(*) as learning_events_total
from learning_events;

-- Breakdown by identity type (every row has exactly one, per the
-- learning_events_exactly_one_identity check constraint).
select
  count(*) filter (where anonymous_visitor_id is not null) as anonymous_event_rows,
  count(*) filter (where learning_user_id is not null)     as authenticated_event_rows
from learning_events;

-- Breakdown by event type, and each type's earliest/latest timestamp --
-- useful for sanity-checking that this really does look like test
-- contamination (e.g. many distinct anonymous visitors, most active during
-- development windows) before deleting anything.
select
  event_type,
  count(*) as row_count,
  count(distinct coalesce(anonymous_visitor_id::text, learning_user_id::text)) as distinct_identities,
  min(created_at) as earliest,
  max(created_at) as latest
from learning_events
group by event_type
order by row_count desc;

-- Explicit confirmation baseline for every table this reset must NEVER
-- touch -- re-run the identical queries in SECTION 3 after the delete and
-- confirm every one of these numbers is IDENTICAL, not just "looks fine".
select
  (select count(*) from learning_users)             as learning_users_total,
  (select count(*) from lesson_progress)            as lesson_progress_total,
  (select count(*) from knowledge_check_results)    as knowledge_check_results_total,
  (select count(*) from learning_auth_handoffs)     as learning_auth_handoffs_total;


-- ============================================================================
-- SECTION 2 -- THE ACTUAL RESET (transactional; DOES NOT AUTO-COMMIT)
-- ============================================================================

begin;

-- "Before" counts, captured again inside the transaction for the permanent
-- record (e.g. paste this output into the incident/change log before you
-- commit).
select count(*) as learning_events_before_delete from learning_events;

-- The reset itself. Deletes EVERY row in the ONLY behavioural analytics
-- table -- deliberately unconditional (no WHERE clause distinguishing
-- "test" from "real" rows), because there is no reliable way to
-- retroactively tell them apart (see the project report: the contamination
-- mechanism means test traffic is indistinguishable from real traffic in
-- this table's own data). This is why the environment guard shipped first:
-- it prevents this from recurring, and no more such resets should be needed
-- after this one.
delete from learning_events;

-- "After" count -- must read exactly 0 before you COMMIT.
select count(*) as learning_events_after_delete from learning_events;

-- STOP HERE. Do not run the next line yet.
-- Review learning_events_after_delete above: it must be exactly 0.
-- Then either:
--   commit;    -- makes the reset permanent
--   rollback;  -- undoes everything above, as if this script never ran


-- ============================================================================
-- SECTION 3 -- POST-RESET VERIFICATION (run AFTER you have committed)
-- ============================================================================

-- Must read 0.
select count(*) as learning_events_total_after_reset from learning_events;

-- Must be IDENTICAL to the SECTION 1 baseline for every one of these four
-- numbers -- if any of them differs, something touched state it should not
-- have, and that needs investigating before trusting this reset.
select
  (select count(*) from learning_users)             as learning_users_total,
  (select count(*) from lesson_progress)            as lesson_progress_total,
  (select count(*) from knowledge_check_results)    as knowledge_check_results_total,
  (select count(*) from learning_auth_handoffs)     as learning_auth_handoffs_total;
