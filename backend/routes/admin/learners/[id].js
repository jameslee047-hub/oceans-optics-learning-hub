// GET /api/admin/learners/:id -- full detail for one learner, `:id` being
// learning_users.id (the internal uuid), never a shopify_customer_id or
// anything supplied by a customer. Never returns a Learning Progress JWT
// -- there is none to return here; this reads the same
// lesson_progress/knowledge_check_results/learning_events rows the
// customer-facing dashboard reads, just for one learner regardless of
// their own session state.
import { requireAdmin } from "../../../lib/require-admin.js";
import { getSupabaseClient } from "../../../lib/supabase.js";
import { computeLearnerDetail, LEARNING_CATALOGUE } from "../../../lib/analytics-service.js";
import { resolveShopifyIdentities, buildLearnerIdentity } from "../../../lib/learner-identity.js";
import { getShopifyAdminConfig } from "../../../lib/shopify-admin-client.js";

// learning_users.id is a Postgres `uuid` column (see migrations/0001_init.sql).
// Postgres's uuid type accepts any syntactically valid UUID (any version/
// variant), not specifically version 4 -- this intentionally checks only
// that general 8-4-4-4-12 hex shape (unlike api/learning-event.js's
// UUID_V4_PATTERN, which validates a CLIENT-GENERATED anonymous_visitor_id
// that must itself be crypto.randomUUID()'s v4 output; here we're just
// pre-validating a value about to be compared against the uuid column, so
// anything Postgres itself would accept should pass). Rejecting anything
// that doesn't fit means a malformed id never reaches the database query
// below -- Postgres would otherwise reject a non-UUID string there as a
// query ERROR, surfacing as an opaque 500 rather than a clean 400.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Factory form so tests can inject a fake Supabase client (see
// test/admin-learners-query-id-routing.test.js's "unknown valid learner"
// case) and a fake Shopify config/fetchImpl (see
// test/admin-learner-shopify-identity-integration.test.js), without needing
// real SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY or live Shopify credentials --
// mirrors the same pattern already used by api/learning-event.js's
// createLearningEventHandler. The default export below is the real,
// unchanged production handler.
export function createLearnerDetailHandler({ getClient = getSupabaseClient, getConfig = getShopifyAdminConfig, fetchImpl = fetch } = {}) {
  return async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const learnerId = req.query?.id;
  if (typeof learnerId !== "string" || learnerId.length === 0 || !UUID_PATTERN.test(learnerId)) {
    res.status(400).json({ error: "invalid_learner_id" });
    return;
  }

  try {
    const supabase = await getClient();
    const { data: user, error: userError } = await supabase
      .from("learning_users")
      .select("id, shopify_customer_id, created_at, last_seen_at")
      .eq("id", learnerId)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) {
      res.status(404).json({ error: "learner_not_found" });
      return;
    }

    const [{ data: lessonProgress, error: lessonProgressError }, { data: quizResults, error: quizResultsError }, { data: events, error: eventsError }] =
      await Promise.all([
        supabase.from("lesson_progress").select("user_id, lesson_id, first_viewed_at, completed_at").eq("user_id", learnerId),
        supabase.from("knowledge_check_results").select("user_id, lesson_id, score, total, completed_at, answers").eq("user_id", learnerId),
        supabase.from("learning_events").select("id, learning_user_id, event_type, lesson_id, created_at").eq("learning_user_id", learnerId)
      ]);
    if (lessonProgressError) throw lessonProgressError;
    if (quizResultsError) throw quizResultsError;
    if (eventsError) throw eventsError;

    const detail = computeLearnerDetail(LEARNING_CATALOGUE, user, lessonProgress || [], quizResults || [], events || []);

    const shopDomain = getConfig().shopDomain;
    let resolved = new Map();
    try {
      resolved = await resolveShopifyIdentities([detail.shopify_customer_id], { getConfig, fetchImpl });
    } catch (error) {
      console.error("GET /api/admin/learners/[id]: identity resolution failed unexpectedly, falling back to customer ID only", error.message);
    }
    const identity = buildLearnerIdentity(detail.shopify_customer_id, resolved, shopDomain);

    res.status(200).json({
      ...detail,
      display_name: identity.display_name,
      email: identity.email,
      shopify_admin_url: identity.shopify_admin_url,
      fallback_label: identity.fallback_label
    });
  } catch (error) {
    console.error("GET /api/admin/learners/[id] failed", error);
    res.status(500).json({ error: "admin_learner_detail_failed" });
  }
  };
}

export default createLearnerDetailHandler();
