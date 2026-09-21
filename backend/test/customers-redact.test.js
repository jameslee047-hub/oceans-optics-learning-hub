import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeSupabase } from "./fake-supabase.js";
import { findOrCreateLearningUser, deleteLearningUserByShopifyCustomerId } from "../lib/supabase.js";
import { recordLessonComplete, recordQuizResult } from "../lib/progress-service.js";

test("findOrCreateLearningUser creates once, then returns the same id on repeat calls", async () => {
  const supabase = createFakeSupabase();
  const firstId = await findOrCreateLearningUser(supabase, 555000111);
  const secondId = await findOrCreateLearningUser(supabase, 555000111);
  assert.equal(firstId, secondId);
  assert.equal(supabase.tables.learning_users.length, 1);
});

test("customers/redact deletes the learning_users row and cascades to progress + quiz results", async () => {
  const supabase = createFakeSupabase();
  const userId = await findOrCreateLearningUser(supabase, 555000111);
  await recordLessonComplete(supabase, userId, "R01");
  await recordQuizResult(supabase, userId, "R08", { score: 3, total: 5 });

  // Sanity check: data exists before redaction.
  assert.equal(supabase.tables.lesson_progress.length, 2); // R01 (explicit) + R08 (from recordQuizResult)
  assert.equal(supabase.tables.knowledge_check_results.length, 1);

  await deleteLearningUserByShopifyCustomerId(supabase, 555000111);

  assert.equal(supabase.tables.learning_users.length, 0);
  assert.equal(supabase.tables.lesson_progress.length, 0, "lesson_progress must cascade-delete");
  assert.equal(supabase.tables.knowledge_check_results.length, 0, "knowledge_check_results must cascade-delete");
});

test("redacting one customer never touches another customer's data", async () => {
  const supabase = createFakeSupabase();
  const userA = await findOrCreateLearningUser(supabase, 555000111);
  const userB = await findOrCreateLearningUser(supabase, 555000222);
  await recordLessonComplete(supabase, userA, "R01");
  await recordLessonComplete(supabase, userB, "R02");

  await deleteLearningUserByShopifyCustomerId(supabase, 555000111);

  assert.equal(supabase.tables.learning_users.length, 1);
  assert.equal(supabase.tables.learning_users[0].shopify_customer_id, 555000222);
  assert.equal(supabase.tables.lesson_progress.length, 1);
  assert.equal(supabase.tables.lesson_progress[0].user_id, userB);
});
