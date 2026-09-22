// GET /api/admin/questions -- per-question Knowledge Check analytics and a
// "questions to review" shortlist, built only from stored answer
// snapshots (migrations/0003_knowledge_check_answers.sql). Legacy rows
// with no snapshot never contribute a fabricated statistic.
import { requireAdmin } from "../../lib/require-admin.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { fetchAllQuizResults } from "../../lib/admin-data.js";
import { computeQuestionAnalytics, questionsToReview, LEARNING_CATALOGUE } from "../../lib/analytics-service.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const supabase = await getSupabaseClient();
    const quizResults = await fetchAllQuizResults(supabase);

    const questions = computeQuestionAnalytics(LEARNING_CATALOGUE, quizResults);
    const toReview = questionsToReview(questions);
    res.status(200).json({ questions, questionsToReview: toReview });
  } catch (error) {
    console.error("GET /api/admin/questions failed", error);
    res.status(500).json({ error: "admin_questions_failed" });
  }
}
