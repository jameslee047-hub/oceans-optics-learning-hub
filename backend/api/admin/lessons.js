// GET /api/admin/lessons -- per-lesson performance for the internal
// analytics dashboard. Sorting happens client-side in the dashboard page
// (the whole published catalogue is 23 lessons -- no server-side sort/
// pagination needed at this scale).
import { requireAdmin } from "../../lib/require-admin.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { fetchAllLessonProgress, fetchAllQuizResults } from "../../lib/admin-data.js";
import { computeLessonPerformance, LEARNING_CATALOGUE } from "../../lib/analytics-service.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const supabase = await getSupabaseClient();
    const [lessonProgress, quizResults] = await Promise.all([fetchAllLessonProgress(supabase), fetchAllQuizResults(supabase)]);

    const lessons = computeLessonPerformance(LEARNING_CATALOGUE, lessonProgress, quizResults);
    res.status(200).json({ lessons });
  } catch (error) {
    console.error("GET /api/admin/lessons failed", error);
    res.status(500).json({ error: "admin_lessons_failed" });
  }
}
