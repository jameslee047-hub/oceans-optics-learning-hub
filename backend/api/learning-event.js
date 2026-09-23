// POST /api/learning-event { event_type, category_handle? } -- the ONE
// authenticated endpoint for page-view-style analytics events the
// frontend self-reports, per the project's "prefer one authenticated
// learning-event endpoint/service rather than separate ad-hoc endpoints"
// decision. Called directly with a bearer session token by
// learning-hub-progress-tracking.js on the Learning Hub homepage,
// category pages, and the My Learning Progress page.
//
// Only CLIENT_REPORTABLE_EVENT_TYPES may be posted here
// (learning_hub_viewed, category_viewed, progress_dashboard_viewed) --
// lesson_viewed/lesson_completed/quiz_completed are deliberately rejected:
// they are already recorded server-side, exactly once per meaningful
// occurrence, inside /api/lesson/viewed, /api/lesson/complete, and
// /api/quiz/result, which already verify the underlying state change
// those events represent. Accepting them here too would risk double
// counting the same occurrence.
//
// Requires the same Learning Progress bearer session as every other
// authenticated endpoint -- there is no anonymous path: an anonymous
// visitor's page views are simply never sent here at all (see
// learning-hub-progress-tracking.js), and no identity is invented for
// one. No fingerprinting, no analytics-only cookie, no IP/user-agent/name/
// email ever enters metadata -- category_handle (validated against the
// real published catalogue) is the only metadata field this endpoint
// accepts.
import { applyCors } from "../lib/cors.js";
import { requireSession } from "../lib/require-session.js";
import { getSupabaseClient, findOrCreateLearningUser } from "../lib/supabase.js";
import { recordPageViewEventBestEffort, isClientReportableEventType, LEARNING_CATALOGUE } from "../lib/analytics-service.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const session = requireSession(req, res);
  if (!session) return;

  const { event_type: eventType, category_handle: categoryHandle } = req.body || {};
  if (typeof eventType !== "string" || !isClientReportableEventType(eventType)) {
    res.status(400).json({ error: "invalid_event_type" });
    return;
  }

  let metadata = null;
  if (eventType === "category_viewed") {
    const knownHandle = LEARNING_CATALOGUE.categories.some((category) => category.handle === categoryHandle);
    if (typeof categoryHandle !== "string" || !knownHandle) {
      res.status(400).json({ error: "invalid_category_handle" });
      return;
    }
    metadata = { category_handle: categoryHandle };
  }

  try {
    const supabase = await getSupabaseClient();
    const userId = await findOrCreateLearningUser(supabase, session.shopify_customer_id);
    await recordPageViewEventBestEffort(supabase, { learningUserId: userId, eventType, metadata });
    res.status(200).json({ recorded: true });
  } catch (error) {
    console.error("POST /api/learning-event failed", error);
    res.status(500).json({ error: "record_event_failed" });
  }
}
