import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeSupabase } from "./fake-supabase.js";
import { findOrCreateLearningUser, deleteLearningUserByShopifyCustomerId } from "../lib/supabase.js";
import { recordLessonComplete, recordQuizResult } from "../lib/progress-service.js";
import { recordLearningEvent } from "../lib/analytics-service.js";

test("findOrCreateLearningUser creates once, then returns the same id on repeat calls", async () => {
  const supabase = createFakeSupabase();
  const firstId = await findOrCreateLearningUser(supabase, 555000111);
  const secondId = await findOrCreateLearningUser(supabase, 555000111);
  assert.equal(firstId, secondId);
  assert.equal(supabase.tables.learning_users.length, 1);
});

test("customers/redact deletes authenticated state/events without treating anonymous events as customer data", async () => {
  const supabase = createFakeSupabase();
  const userId = await findOrCreateLearningUser(supabase, 555000111);
  await recordLessonComplete(supabase, userId, "R01");
  await recordQuizResult(supabase, userId, "R08", { score: 3, total: 5 });
  await recordLearningEvent(supabase, { learningUserId: userId, eventType: "lesson_viewed", lessonId: "R01" });
  await recordLearningEvent(supabase, {
    anonymousVisitorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    eventType: "learning_hub_viewed"
  });

  // Sanity check: data exists before redaction.
  assert.equal(supabase.tables.lesson_progress.length, 2); // R01 (explicit) + R08 (from recordQuizResult)
  assert.equal(supabase.tables.knowledge_check_results.length, 1);
  assert.equal(supabase.tables.learning_events.length, 2);

  await deleteLearningUserByShopifyCustomerId(supabase, 555000111);

  assert.equal(supabase.tables.learning_users.length, 0);
  assert.equal(supabase.tables.lesson_progress.length, 0, "lesson_progress must cascade-delete");
  assert.equal(supabase.tables.knowledge_check_results.length, 0, "knowledge_check_results must cascade-delete");
  assert.equal(supabase.tables.learning_events.length, 1, "only the unrelated anonymous event should remain");
  assert.equal(supabase.tables.learning_events[0].anonymous_visitor_id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
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
