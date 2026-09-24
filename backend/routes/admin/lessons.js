// GET /api/admin/lessons?range=today|7d|30d|all -- per-lesson performance
// for the internal analytics dashboard. Sorting happens client-side in the
// dashboard page (the whole published catalogue is 23 lessons -- no
// server-side sort/pagination needed at this scale). STATE-derived fields
// (learnersStarted/completions/completionRate) are always all-time; EVENT-
// derived fields (views, quiz attempts, viewer->quiz rate, question
// difficulty, follow-on rate) are scoped to `range` -- see
// lib/analytics-service.js's computeLessonPerformance for exactly why.
import { requireAdmin } from "../../lib/require-admin.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { fetchAllLessonProgress, fetchAllQuizResults, fetchAllLearningEvents } from "../../lib/admin-data.js";
import { computeLessonPerformance, computeTrackingStartedAt, resolveDateRange, LEARNING_CATALOGUE } from "../../lib/analytics-service.js";

const VALID_RANGES = new Set(["today", "7d", "30d", "all"]);

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const requestedRange = typeof req.query?.range === "string" ? req.query.range : "all";
  const range = VALID_RANGES.has(requestedRange) ? requestedRange : "all";

  try {
    const supabase = await getSupabaseClient();
    const [lessonProgress, quizResults, events] = await Promise.all([
      fetchAllLessonProgress(supabase),
      fetchAllQuizResults(supabase),
      fetchAllLearningEvents(supabase)
    ]);

    const dateRange = resolveDateRange(range);
    const lessons = computeLessonPerformance(LEARNING_CATALOGUE, lessonProgress, quizResults, events, dateRange);
    res.status(200).json({ range: dateRange.range, lessons, trackingStartedAt: computeTrackingStartedAt(events) });
  } catch (error) {
    console.error("GET /api/admin/lessons failed", error);
    res.status(500).json({ error: "admin_lessons_failed" });
  }
}
