// Core progress read/write logic, kept separate from the Vercel route
// handlers so it can be unit-tested against a fake Supabase client without
// a real database connection. Every function here takes `userId` -- the
// internal learning_users.id -- never a shopify_customer_id or anything
// read from a request body. Route handlers are responsible for resolving
// userId from a verified session token before calling into this file.

export function validateQuizResult({ score, total }) {
  if (!Number.isInteger(score) || !Number.isInteger(total)) {
    return { valid: false, reason: "score_and_total_must_be_integers" };
  }
  if (total <= 0) return { valid: false, reason: "total_must_be_positive" };
  if (score < 0) return { valid: false, reason: "score_must_be_non_negative" };
  if (score > total) return { valid: false, reason: "score_cannot_exceed_total" };
  return { valid: true };
}

export async function recordLessonViewed(supabase, userId, lessonId) {
  // Insert-if-absent only: a repeat "viewed" call must never overwrite an
  // existing first_viewed_at or clear completed_at.
  const { data: existing, error: selectError } = await supabase
    .from("lesson_progress")
    .select("user_id")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return { created: false };

  const { error: insertError } = await supabase
    .from("lesson_progress")
    .insert({ user_id: userId, lesson_id: lessonId });
  if (insertError) throw insertError;
  return { created: true };
}

// Idempotent: calling this twice for the same lesson leaves completed_at at
// its first value rather than bumping it forward on every call.
export async function recordLessonComplete(supabase, userId, lessonId) {
  const { data: existing, error: selectError } = await supabase
    .from("lesson_progress")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing?.completed_at) {
    return { completed_at: existing.completed_at, already_complete: true };
  }

  const completedAt = new Date().toISOString();
  const { error: upsertError } = await supabase
    .from("lesson_progress")
    .upsert(
      { user_id: userId, lesson_id: lessonId, completed_at: completedAt },
      { onConflict: "user_id,lesson_id" }
    );
  if (upsertError) throw upsertError;
  return { completed_at: completedAt, already_complete: false };
}

// Quiz completion is lesson completion (per the approved Phase 2 decision):
// this records the score AND marks the lesson complete in one call.
export async function recordQuizResult(supabase, userId, lessonId, { score, total }) {
  const validation = validateQuizResult({ score, total });
  if (!validation.valid) throw new Error(`invalid_quiz_result:${validation.reason}`);

  const { error: upsertError } = await supabase
    .from("knowledge_check_results")
    .upsert(
      { user_id: userId, lesson_id: lessonId, score, total, completed_at: new Date().toISOString() },
      { onConflict: "user_id,lesson_id" }
    );
  if (upsertError) throw upsertError;

  return recordLessonComplete(supabase, userId, lessonId);
}

export async function getProgress(supabase, userId) {
  const [{ data: lessons, error: lessonsError }, { data: quizzes, error: quizzesError }] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id, first_viewed_at, completed_at").eq("user_id", userId),
    supabase.from("knowledge_check_results").select("lesson_id, score, total, completed_at").eq("user_id", userId)
  ]);
  if (lessonsError) throw lessonsError;
  if (quizzesError) throw quizzesError;
  return { lessons: lessons || [], quizzes: quizzes || [] };
}
