// Thin, shared Supabase reads for the internal admin dashboard routes --
// kept separate only to avoid repeating the same four query shapes across
// routes/admin/summary.js, lessons.js, questions.js, and learners.js. No
// aggregation logic lives here; see lib/analytics-service.js for that.
//
// Every select is scoped to columns this feature actually needs -- in
// particular, learning_users is never selected with anything beyond
// id/shopify_customer_id/created_at/last_seen_at, since no other column
// exists on it to leak (zero-PII schema).
export async function fetchAllLearningUsers(supabase) {
  const { data, error } = await supabase.from("learning_users").select("id, shopify_customer_id, created_at, last_seen_at");
  if (error) throw error;
  return data || [];
}

export async function fetchAllLessonProgress(supabase) {
  const { data, error } = await supabase.from("lesson_progress").select("user_id, lesson_id, first_viewed_at, completed_at");
  if (error) throw error;
  return data || [];
}

export async function fetchAllQuizResults(supabase) {
  const { data, error } = await supabase.from("knowledge_check_results").select("user_id, lesson_id, score, total, completed_at, answers");
  if (error) throw error;
  return data || [];
}

// Unfiltered by design: summary metrics need events from BEFORE the
// selected range too, to determine whether a learner active in the range
// was already active earlier ("returning learners"). At this project's
// current data volume, fetching the whole table is simple and fast enough
// for an internal tool refreshed on demand; revisit if learning_events
// grows large enough for that to change.
export async function fetchAllLearningEvents(supabase) {
  const { data, error } = await supabase
    .from("learning_events")
    .select("id, learning_user_id, event_type, lesson_id, created_at, metadata");
  if (error) throw error;
  return data || [];
}
