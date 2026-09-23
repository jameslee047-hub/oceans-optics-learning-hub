// GET /api/admin/learners -- one row per registered learner for the
// internal analytics dashboard. Identity is the numeric shopify_customer_id
// already stored in learning_users -- no name/email is available or
// requested (see the project report's Shopify identity lookup findings).
import { requireAdmin } from "../../lib/require-admin.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { fetchAllLearningUsers, fetchAllLessonProgress, fetchAllQuizResults } from "../../lib/admin-data.js";
import { computeLearnerTable, LEARNING_CATALOGUE } from "../../lib/analytics-service.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const supabase = await getSupabaseClient();
    const [users, lessonProgress, quizResults] = await Promise.all([
      fetchAllLearningUsers(supabase),
      fetchAllLessonProgress(supabase),
      fetchAllQuizResults(supabase)
    ]);

    const learners = computeLearnerTable(LEARNING_CATALOGUE, users, lessonProgress, quizResults);
    res.status(200).json({ learners });
  } catch (error) {
    console.error("GET /api/admin/learners failed", error);
    res.status(500).json({ error: "admin_learners_failed" });
  }
}
