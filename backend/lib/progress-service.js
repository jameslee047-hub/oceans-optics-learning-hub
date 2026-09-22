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

// Optional per-question answer-review snapshot for a Knowledge Check
// result -- see migrations/0003_knowledge_check_answers.sql. A snapshot,
// not a reference into current quiz content/IDs, since lesson quiz content
// can change after a customer completes it. `undefined`/`null` is valid
// (backward compatible: older/other callers that don't send answers still
// work exactly as before, and the row's answers column is explicitly set
// to null, matching "current result" semantics on a retake).
//
// Strict and whitelisting: any item missing/mistyping a required field, or
// carrying extra properties, is rejected outright rather than silently
// dropped or passed through -- this is untrusted request-body input.
// Returns { valid, answers } where `answers` is either null or a
// normalized (whitelisted-fields-only) copy of the input array.
const MAX_ANSWER_ITEMS = 50;
const MAX_ANSWER_TEXT_LENGTH = 2000;
const MAX_QUESTION_ID_LENGTH = 64;

function isNonEmptyBoundedString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export function validateAnswerReview(answers) {
  if (answers === undefined || answers === null) return { valid: true, answers: null };
  if (!Array.isArray(answers)) return { valid: false, reason: "answers_must_be_an_array" };
  if (answers.length === 0) return { valid: false, reason: "answers_must_not_be_empty" };
  if (answers.length > MAX_ANSWER_ITEMS) return { valid: false, reason: "answers_too_large" };

  const normalized = [];
  for (const item of answers) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { valid: false, reason: "invalid_answer_item" };
    }
    if (!isNonEmptyBoundedString(item.question_id, MAX_QUESTION_ID_LENGTH)) {
      return { valid: false, reason: "invalid_answer_question_id" };
    }
    if (!isNonEmptyBoundedString(item.question, MAX_ANSWER_TEXT_LENGTH)) {
      return { valid: false, reason: "invalid_answer_question" };
    }
    if (!isNonEmptyBoundedString(item.selected, MAX_ANSWER_TEXT_LENGTH)) {
      return { valid: false, reason: "invalid_answer_selected" };
    }
    if (!isNonEmptyBoundedString(item.correct, MAX_ANSWER_TEXT_LENGTH)) {
      return { valid: false, reason: "invalid_answer_correct" };
    }
    if (typeof item.is_correct !== "boolean") {
      return { valid: false, reason: "invalid_answer_is_correct" };
    }

    normalized.push({
      question_id: item.question_id,
      question: item.question,
      selected: item.selected,
      correct: item.correct,
      is_correct: item.is_correct
    });
  }

  return { valid: true, answers: normalized };
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
// `answers` is optional (see validateAnswerReview) -- always written
// explicitly (including as null when omitted), so a retake's row always
// reflects that SAME attempt's answers, never a stale snapshot from a
// previous attempt left behind by an upsert that only touched score/total.
export async function recordQuizResult(supabase, userId, lessonId, { score, total, answers }) {
  const validation = validateQuizResult({ score, total });
  if (!validation.valid) throw new Error(`invalid_quiz_result:${validation.reason}`);

  const answerValidation = validateAnswerReview(answers);
  if (!answerValidation.valid) throw new Error(`invalid_quiz_result:${answerValidation.reason}`);

  const { error: upsertError } = await supabase
    .from("knowledge_check_results")
    .upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        score,
        total,
        answers: answerValidation.answers,
        completed_at: new Date().toISOString()
      },
      { onConflict: "user_id,lesson_id" }
    );
  if (upsertError) throw upsertError;

  return recordLessonComplete(supabase, userId, lessonId);
}

export async function getProgress(supabase, userId) {
  const [{ data: lessons, error: lessonsError }, { data: quizzes, error: quizzesError }] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id, first_viewed_at, completed_at").eq("user_id", userId),
    supabase.from("knowledge_check_results").select("lesson_id, score, total, completed_at, answers").eq("user_id", userId)
  ]);
  if (lessonsError) throw lessonsError;
  if (quizzesError) throw quizzesError;
  return { lessons: lessons || [], quizzes: quizzes || [] };
}
