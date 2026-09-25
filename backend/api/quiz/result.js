// POST /api/quiz/result { lesson_id, score, total, answers? } -- called
// directly with a bearer session token when learning-hub-knowledge-check.js
// dispatches `oo:knowledge-check-completed`. Per the approved Phase 2
// decision, this both records the score AND marks the lesson complete
// (quiz completion IS lesson completion) -- see lib/progress-service.js's
// recordQuizResult.
//
// `answers` is an optional per-question answer-review snapshot (see
// migrations/0003_knowledge_check_answers.sql and
// lib/progress-service.js's validateAnswerReview) -- omitting it is fully
// supported for backward compatibility with any caller that predates this
// feature; it is never required for score/total to be recorded.
import { applyCors } from "../../lib/cors.js";
import { requireSession } from "../../lib/require-session.js";
import { getSupabaseClient, findOrCreateLearningUser } from "../../lib/supabase.js";
import { recordQuizResult, validateQuizResult, validateAnswerReview } from "../../lib/progress-service.js";
import { recordLearningEventBestEffort } from "../../lib/analytics-service.js";
import { isBehavioralAnalyticsEnabled } from "../../lib/analytics-policy.js";

const LESSON_ID_PATTERN = /^R\d{2}$/;

// Factory form so tests can inject a fake Supabase client and force the
// analytics-enabled decision, proving the environment guard without
// needing real SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY or VERCEL_ENV --
// mirrors the same pattern already used by api/learning-event.js's
// createLearningEventHandler and routes/admin/learners.js's
// createLearnersListHandler. The default export below is the real,
// unchanged production handler.
export function createQuizResultHandler({ getClient = getSupabaseClient, analyticsEnabled = isBehavioralAnalyticsEnabled } = {}) {
  return async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const session = requireSession(req, res);
  if (!session) return;

  const { lesson_id: lessonId, score, total, answers } = req.body || {};
  if (typeof lessonId !== "string" || !LESSON_ID_PATTERN.test(lessonId)) {
    res.status(400).json({ error: "invalid_lesson_id" });
    return;
  }

  const validation = validateQuizResult({ score, total });
  if (!validation.valid) {
    res.status(400).json({ error: validation.reason });
    return;
  }

  // Validated here too (not only inside recordQuizResult) so a malformed/
  // oversized answers payload is rejected with its own specific 400 before
  // any database work, the same pattern lesson_id/score/total already use.
  const answerValidation = validateAnswerReview(answers);
  if (!answerValidation.valid) {
    res.status(400).json({ error: answerValidation.reason });
    return;
  }

  try {
    const supabase = await getClient();
    const userId = await findOrCreateLearningUser(supabase, session.shopify_customer_id);
    const result = await recordQuizResult(supabase, userId, lessonId, { score, total, answers: answerValidation.answers });

    // Each submission (including a retake) is a meaningful, deliberate
    // action -- always recorded. lesson_completed only fires the FIRST
    // time this lesson is completed (already_complete stays false only
    // once), never again on a retake of an already-complete lesson.
    //
    // The score/completion STATE write above (recordQuizResult) always
    // happens regardless of environment -- only these behavioural analytics
    // events are gated, so a Preview/dev learner's progress still saves.
    if (analyticsEnabled()) {
      await recordLearningEventBestEffort(supabase, {
        learningUserId: userId,
        eventType: "quiz_completed",
        lessonId,
        metadata: { score, total, answers: answerValidation.answers }
      });
      if (!result.already_complete) {
        await recordLearningEventBestEffort(supabase, { learningUserId: userId, eventType: "lesson_completed", lessonId });
      }
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("POST /api/quiz/result failed", error);
    res.status(500).json({ error: "record_quiz_result_failed" });
  }
  };
}

export default createQuizResultHandler();
