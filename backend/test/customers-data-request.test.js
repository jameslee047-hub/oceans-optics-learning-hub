// Exercises the same lookup logic api/webhooks/customers-data-request.js
// uses (select learning_users by shopify_customer_id, then getProgress for
// that row's internal id) against the fake Supabase, proving it resolves
// exactly the requesting customer's data and never another customer's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeSupabase } from "./fake-supabase.js";
import { findOrCreateLearningUser } from "../lib/supabase.js";
import { recordLessonComplete, recordQuizResult, getProgress } from "../lib/progress-service.js";

async function resolveDataRequestProgress(supabase, shopifyCustomerId) {
  const { data: existing } = await supabase.from("learning_users").select("id").eq("shopify_customer_id", shopifyCustomerId).maybeSingle();
  return existing ? getProgress(supabase, existing.id) : { lessons: [], quizzes: [] };
}

test("customers/data_request resolves the correct customer's progress by shopify_customer_id", async () => {
  const supabase = createFakeSupabase();
  const userA = await findOrCreateLearningUser(supabase, 555000111);
  const userB = await findOrCreateLearningUser(supabase, 555000222);
  await recordLessonComplete(supabase, userA, "R01");
  await recordQuizResult(supabase, userA, "R08", { score: 4, total: 5 });
  await recordLessonComplete(supabase, userB, "R02");

  const progressA = await resolveDataRequestProgress(supabase, 555000111);
  // R01 (explicit recordLessonComplete) + R08 (recordQuizResult also marks
  // its own lesson complete -- "quiz completion is lesson completion").
  assert.equal(progressA.lessons.length, 2);
  assert.deepEqual(
    progressA.lessons.map((l) => l.lesson_id).sort(),
    ["R01", "R08"]
  );
  assert.equal(progressA.quizzes.length, 1);
  assert.equal(progressA.quizzes[0].lesson_id, "R08");
});

test("customers/data_request for a customer with no learning_users row returns empty, and creates no row", async () => {
  const supabase = createFakeSupabase();
  const progress = await resolveDataRequestProgress(supabase, 999000999);
  assert.deepEqual(progress, { lessons: [], quizzes: [] });
  assert.equal(supabase.tables.learning_users?.length ?? 0, 0, "a data request must never itself start tracking someone");
});

test("customers/data_request never includes another customer's data", async () => {
  const supabase = createFakeSupabase();
  const userA = await findOrCreateLearningUser(supabase, 555000111);
  const userB = await findOrCreateLearningUser(supabase, 555000222);
  await recordLessonComplete(supabase, userA, "R01");
  await recordLessonComplete(supabase, userB, "R02");

  const progressA = await resolveDataRequestProgress(supabase, 555000111);
  assert.equal(progressA.lessons.length, 1);
  assert.equal(progressA.lessons[0].lesson_id, "R01");
});
