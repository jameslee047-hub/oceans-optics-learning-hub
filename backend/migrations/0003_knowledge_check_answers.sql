-- Learning Hub Phase B, Checkpoint 4 -- Knowledge Check answer review.
--
-- Adds an optional column to the EXISTING knowledge_check_results table so
-- future quiz completions can persist enough detail to review which
-- answers a customer chose, without building a quiz-attempt-history
-- architecture: this table still stores exactly one row per
-- (user_id, lesson_id) -- a retake still replaces it via the same upsert
-- used since 0001_init.sql, now simply also replacing `answers`.
--
-- Additive only: does not alter 0001_init.sql or 0002_auth_handoffs.sql.
-- `add column if not exists` and `drop constraint if exists` before
-- re-adding make this migration safe to run more than once.
--
-- Snapshot, not a reference: each element captures the question/answer
-- TEXT as shown at completion time (see lib/progress-service.js), not an
-- index or ID into the current learning-hub-knowledge-check-data.js
-- content -- that content can change later, and a stored review must keep
-- meaning even if it does.
--
-- Existing rows are untouched by this migration and read back with
-- answers = NULL, which the backend and dashboard already treat as
-- "no answer review available for this earlier result" -- not an error,
-- and never presented as if it were a missing/zero score.

alter table knowledge_check_results
  add column if not exists answers jsonb;

-- Defense-in-depth only (the real shape/size validation is in
-- lib/progress-service.js's validateAnswerReview, which runs before any
-- write reaches the database): a non-null value must at least be a JSON
-- array, never an object/string/number, so a malformed value can never
-- silently land in a shape the dashboard's reader does not expect.
alter table knowledge_check_results
  drop constraint if exists answers_is_array_or_null;

alter table knowledge_check_results
  add constraint answers_is_array_or_null
  check (answers is null or jsonb_typeof(answers) = 'array');

-- No grant changes needed: service_role already has select/insert/update/
-- delete on this table from 0001_init.sql, which covers the new column
-- (Postgres column-level privileges are inherited from the table-level
-- grant already in place; a new column never needs its own grant).
