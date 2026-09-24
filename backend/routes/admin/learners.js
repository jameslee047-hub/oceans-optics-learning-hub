// GET /api/admin/learners -- one row per registered learner for the
// internal analytics dashboard. Identity is the numeric shopify_customer_id
// already stored in learning_users; display_name/shopify_admin_url are
// resolved from Shopify on demand for this response only (never persisted
// -- see lib/learner-identity.js) and fall back to the numeric ID alone if
// unavailable. Email is deliberately omitted from this list view -- see
// routes/admin/learners/[id].js for the detail view, which includes it.
import { requireAdmin } from "../../lib/require-admin.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { fetchAllLearningUsers, fetchAllLessonProgress, fetchAllQuizResults } from "../../lib/admin-data.js";
import { computeLearnerTable, LEARNING_CATALOGUE } from "../../lib/analytics-service.js";
import { resolveShopifyIdentities, buildLearnerIdentity } from "../../lib/learner-identity.js";
import { getShopifyAdminConfig } from "../../lib/shopify-admin-client.js";

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

    const shopDomain = getShopifyAdminConfig().shopDomain;
    let resolved = new Map();
    try {
      resolved = await resolveShopifyIdentities(learners.map((learner) => learner.shopify_customer_id));
    } catch (error) {
      // resolveShopifyIdentities is designed to never throw; this is
      // belt-and-braces so a Shopify identity lookup problem can never turn
      // an otherwise-successful learner list into a 500.
      console.error("GET /api/admin/learners: identity resolution failed unexpectedly, falling back to customer IDs only", error.message);
    }
    const enriched = learners.map((learner) => {
      const identity = buildLearnerIdentity(learner.shopify_customer_id, resolved, shopDomain);
      return {
        ...learner,
        display_name: identity.display_name,
        shopify_admin_url: identity.shopify_admin_url,
        fallback_label: identity.fallback_label
      };
    });

    res.status(200).json({ learners: enriched });
  } catch (error) {
    console.error("GET /api/admin/learners failed", error);
    res.status(500).json({ error: "admin_learners_failed" });
  }
}
