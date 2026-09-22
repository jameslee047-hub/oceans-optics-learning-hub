-- Learning Hub Phase B, Checkpoint 5 -- analytics event log for the
-- internal admin dashboard (api/admin/*). Additive only: does not modify
-- 0001_init.sql, 0002_auth_handoffs.sql, or 0003_knowledge_check_answers.sql.
--
-- learning_events is history/analytics, NOT a replacement for existing
-- state: lesson_progress and knowledge_check_results remain the source of
-- truth for "is this lesson complete / what was the score" (see
-- lib/progress-service.js). This table only records that a meaningful
-- learning event happened and when, for aggregation.
--
-- Zero-PII, same as every other table here: event_type/lesson_id/metadata
-- may never carry a customer name/email/address/phone. metadata is for
-- small structured details about the event itself (e.g. which category
-- handle was viewed), not for anything identifying beyond the existing
-- learning_user_id foreign key.
--
-- learning_user_id is nullable because a genuinely anonymous page-view
-- event (if ever wired up client-side -- see the backend report for which
-- event types are actually recorded as of this migration) has no
-- authenticated identity to attach; an authenticated event (lesson_viewed,
-- lesson_completed, quiz_completed, progress_dashboard_viewed) always sets
-- it, since those already require a verified Learning Progress session.

create table learning_events (
  id uuid primary key default gen_random_uuid(),
  learning_user_id uuid references learning_users(id) on delete cascade,
  event_type text not null,
  lesson_id text,
  created_at timestamptz not null default now(),
  metadata jsonb,
  constraint lesson_id_format check (lesson_id is null or lesson_id ~ '^R[0-9]{2}$'),
  -- Enumerated on purpose ("track meaningful learning events rather than
  -- arbitrary clicks"): a new event type is a deliberate schema change,
  -- not something any caller can invent by sending an arbitrary string.
  -- learning_hub_viewed/category_viewed are included for forward
  -- compatibility even though nothing writes them yet as of this
  -- migration (see the backend report) -- adding the client-side wiring
  -- later needs no schema change.
  constraint event_type_known check (
    event_type in (
      'learning_hub_viewed',
      'category_viewed',
      'lesson_viewed',
      'lesson_completed',
      'quiz_completed',
      'progress_dashboard_viewed'
    )
  )
);

-- Powers "active/returning learners in period" and the learner detail
-- timeline: both filter by learning_user_id and order/range by created_at.
create index learning_events_user_created_idx on learning_events(learning_user_id, created_at);

-- Powers per-event-type, per-period aggregation (e.g. "lesson_completed
-- events in the last 7 days") without needing the user index.
create index learning_events_type_created_idx on learning_events(event_type, created_at);

alter table learning_events enable row level security;

-- No policies, matching every other table in this project: service_role
-- bypasses RLS entirely (BYPASSRLS), and a zero-policy table denies every
-- other role regardless of what it is granted below.

grant select, insert, update, delete on table learning_events to service_role;

revoke all on table learning_events from anon, authenticated;
