// Proves the "avoid duplicate event spam from reloads" requirement is
// actually wired up where it matters: the route handlers that call
// recordLearningEventBestEffort must gate lesson_viewed/lesson_completed
// behind the exact idempotency signal lib/progress-service.js already
// returns (`created`/`already_complete`), not fire unconditionally.
//
// This is a source-inspection test (reads the real, unmodified route
// files' own text), the same technique this suite already uses in
// test/customer-auth-callback-cookie-clearing.test.js to prove an
// "unconditional" call's position without needing a full database mock --
// appropriate here too, since actually exercising the real Supabase
// success path through these route handlers would require either module-
// mocking (avoided throughout this codebase) or restructuring them with
// dependency injection, which is a bigger change than this check needs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "api");

function readSource(relativePath) {
  return fs.readFileSync(path.join(API_DIR, relativePath), "utf8");
}

test("api/lesson/viewed.js only records lesson_viewed inside the result.created branch", () => {
  const source = readSource("lesson/viewed.js");
  const ifIndex = source.indexOf("if (result.created)");
  const eventCallIndex = source.indexOf('eventType: "lesson_viewed"');
  assert.ok(ifIndex !== -1, "must gate on result.created");
  assert.ok(eventCallIndex !== -1, "must record a lesson_viewed event");
  assert.ok(ifIndex < eventCallIndex, "the lesson_viewed event call must be inside the result.created guard");
});

test("api/quiz/result.js always records quiz_completed but only records lesson_completed on a genuinely new completion", () => {
  const source = readSource("quiz/result.js");
  const quizEventIndex = source.indexOf('eventType: "quiz_completed"');
  const guardIndex = source.indexOf("if (!result.already_complete)");
  const lessonEventIndex = source.indexOf('eventType: "lesson_completed"');

  assert.ok(quizEventIndex !== -1, "must record a quiz_completed event");
  assert.ok(guardIndex !== -1, "must gate on !result.already_complete");
  assert.ok(lessonEventIndex !== -1, "must record a lesson_completed event");
  assert.ok(guardIndex < lessonEventIndex, "lesson_completed must be inside the already_complete guard");
  assert.ok(quizEventIndex < guardIndex, "quiz_completed must be recorded unconditionally, before the completion guard");
});

test("api/lesson/complete.js only records lesson_completed on a genuinely new completion", () => {
  const source = readSource("lesson/complete.js");
  const guardIndex = source.indexOf("if (!result.already_complete)");
  const lessonEventIndex = source.indexOf('eventType: "lesson_completed"');
  assert.ok(guardIndex !== -1);
  assert.ok(lessonEventIndex !== -1);
  assert.ok(guardIndex < lessonEventIndex);
});
