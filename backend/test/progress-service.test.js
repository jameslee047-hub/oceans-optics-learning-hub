import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeSupabase } from "./fake-supabase.js";
import {
  validateQuizResult,
  recordLessonViewed,
  recordLessonComplete,
  recordQuizResult,
  getProgress
} from "../lib/progress-service.js";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

test("quiz score validation: valid scores pass", () => {
  assert.equal(validateQuizResult({ score: 0, total: 4 }).valid, true);
  assert.equal(validateQuizResult({ score: 4, total: 4 }).valid, true);
  assert.equal(validateQuizResult({ score: 2, total: 4 }).valid, true);
});

test("quiz score validation: rejects score above total", () => {
  const result = validateQuizResult({ score: 5, total: 4 });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "score_cannot_exceed_total");
});

test("quiz score validation: rejects negative score", () => {
  assert.equal(validateQuizResult({ score: -1, total: 4 }).valid, false);
});

test("quiz score validation: rejects zero or negative total", () => {
  assert.equal(validateQuizResult({ score: 0, total: 0 }).valid, false);
  assert.equal(validateQuizResult({ score: 0, total: -3 }).valid, false);
});

test("quiz score validation: rejects non-integer input", () => {
  assert.equal(validateQuizResult({ score: 1.5, total: 4 }).valid, false);
  assert.equal(validateQuizResult({ score: "2", total: 4 }).valid, false);
});

test("recordLessonViewed is idempotent: second call does not duplicate the row", async () => {
  const supabase = createFakeSupabase();
  await recordLessonViewed(supabase, USER_A, "R01");
  await recordLessonViewed(supabase, USER_A, "R01");

  const rows = supabase.tables.lesson_progress.filter((row) => row.user_id === USER_A && row.lesson_id === "R01");
  assert.equal(rows.length, 1);
});

test("recordLessonComplete is idempotent: completed_at does not move forward on repeat calls", async () => {
  const supabase = createFakeSupabase();
  const first = await recordLessonComplete(supabase, USER_A, "R01");
  const second = await recordLessonComplete(supabase, USER_A, "R01");

  assert.equal(first.already_complete, false);
  assert.equal(second.already_complete, true);
  assert.equal(first.completed_at, second.completed_at);
});

test("recordQuizResult marks the lesson complete (quiz completion is lesson completion)", async () => {
  const supabase = createFakeSupabase();
  await recordQuizResult(supabase, USER_A, "R08", { score: 4, total: 5 });

  const progressRow = supabase.tables.lesson_progress.find((row) => row.user_id === USER_A && row.lesson_id === "R08");
  assert.ok(progressRow, "lesson_progress row should exist after a quiz result");
  assert.ok(progressRow.completed_at, "lesson should be marked complete");

  const quizRow = supabase.tables.knowledge_check_results.find((row) => row.user_id === USER_A && row.lesson_id === "R08");
  assert.equal(quizRow.score, 4);
  assert.equal(quizRow.total, 5);
});

test("recordQuizResult rejects an invalid score before writing anything", async () => {
  const supabase = createFakeSupabase();
  await assert.rejects(() => recordQuizResult(supabase, USER_A, "R08", { score: 9, total: 5 }));
  assert.equal(supabase.tables.knowledge_check_results?.length ?? 0, 0);
});

test("retaking a quiz updates the existing result rather than creating a duplicate row", async () => {
  const supabase = createFakeSupabase();
  await recordQuizResult(supabase, USER_A, "R08", { score: 2, total: 5 });
  await recordQuizResult(supabase, USER_A, "R08", { score: 5, total: 5 });

  const rows = supabase.tables.knowledge_check_results.filter((row) => row.user_id === USER_A && row.lesson_id === "R08");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].score, 5);
});

test("getProgress for one user never includes another user's rows", async () => {
  const supabase = createFakeSupabase();
  await recordLessonComplete(supabase, USER_A, "R01");
  await recordQuizResult(supabase, USER_A, "R01", { score: 3, total: 4 });
  await recordLessonComplete(supabase, USER_B, "R02");
  await recordQuizResult(supabase, USER_B, "R02", { score: 1, total: 4 });

  const progressA = await getProgress(supabase, USER_A);
  assert.equal(progressA.lessons.length, 1);
  assert.equal(progressA.lessons[0].lesson_id, "R01");
  assert.equal(progressA.quizzes.length, 1);
  assert.equal(progressA.quizzes[0].lesson_id, "R01");

  const progressB = await getProgress(supabase, USER_B);
  assert.equal(progressB.lessons[0].lesson_id, "R02");
});

test("getProgress reflects a freshly viewed (not yet completed) lesson alongside a completed quiz lesson", async () => {
  const supabase = createFakeSupabase();
  await recordLessonViewed(supabase, USER_A, "R05");
  await recordQuizResult(supabase, USER_A, "R08", { score: 3, total: 4 });

  const progress = await getProgress(supabase, USER_A);

  const viewedLesson = progress.lessons.find((row) => row.lesson_id === "R05");
  assert.ok(viewedLesson, "the viewed-only lesson must appear in progress");
  assert.ok(!viewedLesson.completed_at, "a merely-viewed lesson must not be marked complete");

  const completedLesson = progress.lessons.find((row) => row.lesson_id === "R08");
  assert.ok(completedLesson.completed_at, "the quiz-completed lesson must be marked complete");

  assert.equal(progress.quizzes.length, 1);
  assert.equal(progress.quizzes[0].lesson_id, "R08");
  assert.equal(progress.quizzes[0].score, 3);
  assert.equal(progress.quizzes[0].total, 4);
});
