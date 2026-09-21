// POST /api/lesson/complete { lesson_id } -- the explicit-completion
// fallback path for a future lesson with no Knowledge Check (not used by
// any lesson today; quiz completion goes through /api/quiz/result instead,
// which calls the same underlying recordLessonComplete). Idempotent.
import { applyCors } from "../../lib/cors.js";
import { requireSession } from "../../lib/require-session.js";
import { getSupabaseClient, findOrCreateLearningUser } from "../../lib/supabase.js";
import { recordLessonComplete } from "../../lib/progress-service.js";

const LESSON_ID_PATTERN = /^R\d{2}$/;

export default async function handler(req, res) {
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
    const supabase = await getSupabaseClient();
    const userId = await findOrCreateLearningUser(supabase, session.shopify_customer_id);
    const result = await recordLessonComplete(supabase, userId, lessonId);
    res.status(200).json(result);
  } catch (error) {
    console.error("POST /api/lesson/complete failed", error);
    res.status(500).json({ error: "record_complete_failed" });
  }
}
