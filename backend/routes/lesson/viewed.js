// POST /api/lesson/viewed { lesson_id } -- called directly with a bearer
// session token. lesson_id must be a stable internal ID (R01..R31), never a
// public handle -- see migrations/0001_init.sql for why.
import { applyCors } from "../../lib/cors.js";
import { requireSession } from "../../lib/require-session.js";
import { getSupabaseClient, findOrCreateLearningUser } from "../../lib/supabase.js";
import { recordLessonViewed } from "../../lib/progress-service.js";
import { recordPageViewEventBestEffort } from "../../lib/analytics-service.js";
import { isBehavioralAnalyticsEnabled } from "../../lib/analytics-policy.js";

const LESSON_ID_PATTERN = /^R\d{2}$/;

// Factory form so tests can inject a fake Supabase client and force the
// analytics-enabled decision (see api/quiz/result.js's
// createQuizResultHandler for the same pattern). The default export below
// is the real, unchanged production handler.
export function createLessonViewedHandler({ getClient = getSupabaseClient, analyticsEnabled = isBehavioralAnalyticsEnabled } = {}) {
  return async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const session = requireSession(req, res);
  if (!session) return;

  const { lesson_id: lessonId } = req.body || {};
  if (typeof lessonId !== "string" || !LESSON_ID_PATTERN.test(lessonId)) {
    res.status(400).json({ error: "invalid_lesson_id" });
    return;
  }

  try {
    const supabase = await getClient();
    const userId = await findOrCreateLearningUser(supabase, session.shopify_customer_id);
    const result = await recordLessonViewed(supabase, userId, lessonId);

    // Recorded on EVERY genuine view, not gated on result.created --
    // lesson_progress.first_viewed_at only ever records the FIRST view,
    // so gating on it would silently drop every real repeat visit from
    // activity analytics. recordPageViewEventBestEffort itself absorbs a
    // page refresh/rapid reload via its own short time-window dedupe (see
    // lib/analytics-service.js), which is the correct place to prevent
    // spam without also discarding a genuine visit hours or days later.
    //
    // recordLessonViewed's progress-state write above always happens
    // regardless of environment -- only this behavioural analytics event is
    // gated, so a Preview/dev learner's "viewed" state still saves.
    if (analyticsEnabled()) {
      await recordPageViewEventBestEffort(supabase, { learningUserId: userId, eventType: "lesson_viewed", lessonId });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("POST /api/lesson/viewed failed", error);
    res.status(500).json({ error: "record_viewed_failed" });
  }
  };
}

export default createLessonViewedHandler();
