// Proves the deduplication strategy is wired up correctly and DISTINCTLY
// per event type, per the corrected architecture:
//   - lesson_viewed: recorded on EVERY genuine view via
//     recordPageViewEventBestEffort (short time-window dedupe inside that
//     function absorbs refresh/reload spam) -- deliberately NOT gated on
//     result.created, since lesson_progress.first_viewed_at only ever
//     records the FIRST view ever and would silently drop every real
//     repeat visit from activity analytics if used as a gate here.
//   - lesson_completed / quiz_completed: still gated on the existing
//     state-table idempotency signals (`already_complete`), since
//     "lesson completed" is a one-time state milestone per lesson, and
//     "quiz completed" already correctly fires on every retake via the
//     plain (non-deduped) recordLearningEventBestEffort.
//
// This is a source-inspection test (reads the real, unmodified route
// files' own text), the same technique this suite already uses in
// test/customer-auth-callback-cookie-clearing.test.js to prove a call's
// position without needing a full database mock -- appropriate here too,
// since actually exercising the real Supabase success path through these
// route handlers would require either module-mocking (avoided throughout
// this codebase) or restructuring them with dependency injection, which
// is a bigger change than this check needs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "api");

function readSource(relativePath) {
  return fs.readFileSync(path.join(API_DIR, relativePath), "utf8");
}

test("api/lesson/viewed.js records lesson_viewed via the deduped recordPageViewEventBestEffort, unconditionally on every view", () => {
  const source = readSource("lesson/viewed.js");
  assert.ok(source.includes("recordPageViewEventBestEffort"), "must use the time-window-deduped recorder, not the plain one");
  assert.ok(!source.includes("if (result.created)"), "must NOT gate lesson_viewed on first-view-ever -- that would drop real repeat visits");
  assert.ok(source.includes('eventType: "lesson_viewed"'));
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
