// GET /api/admin/questions -- attempt-based question analytics across
// authenticated and anonymous quiz_completed events. Historical events
// without answer snapshots are skipped, never fabricated or mixed with
// current/latest authenticated state rows.
import { requireAdmin } from "../../lib/require-admin.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { fetchAllLearningEvents } from "../../lib/admin-data.js";
import { computeQuestionAnalytics, questionsToReview, LEARNING_CATALOGUE } from "../../lib/analytics-service.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const supabase = await getSupabaseClient();
    const events = await fetchAllLearningEvents(supabase);

    const questions = computeQuestionAnalytics(
      LEARNING_CATALOGUE,
      events.filter((event) => event.event_type === "quiz_completed")
    );
    // Below this many attempts, a single response swings the incorrect %
    // wildly (e.g. 1 attempt = 0% or 100%) -- excluded from the primary
    // review list, but never hidden entirely: the dashboard can still show
    // every question with at least one wrong answer via `questions`.
    const MIN_SAMPLE_SIZE = 3;
    const toReview = questionsToReview(questions, { minSampleSize: MIN_SAMPLE_SIZE });
    res.status(200).json({ questions, questionsToReview: toReview, minSampleSize: MIN_SAMPLE_SIZE });
  } catch (error) {
    console.error("GET /api/admin/questions failed", error);
    res.status(500).json({ error: "admin_questions_failed" });
  }
}
