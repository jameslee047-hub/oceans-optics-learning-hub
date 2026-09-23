// GET /api/admin/summary?range=today|7d|30d|all -- internal analytics
// dashboard only (see lib/require-admin.js). Never reachable with a
// customer Learning Progress bearer token; never CORS-enabled, since it is
// only ever called same-origin by api/admin/index.js's own page.
import { requireAdmin } from "../../lib/require-admin.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { fetchAllLearningUsers, fetchAllLearningEvents } from "../../lib/admin-data.js";
import { resolveDateRange, computeSummaryMetrics } from "../../lib/analytics-service.js";

const VALID_RANGES = new Set(["today", "7d", "30d", "all"]);

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const requestedRange = typeof req.query?.range === "string" ? req.query.range : "all";
  const range = VALID_RANGES.has(requestedRange) ? requestedRange : "all";

  try {
    const supabase = await getSupabaseClient();
    // totalLearners is the only STATE-derived figure here (learning_users);
    // every behavioural figure comes from learning_events -- see
    // lib/analytics-service.js's computeSummaryMetrics for exactly why
    // lesson_progress/knowledge_check_results are deliberately NOT read
    // for this endpoint.
    const [users, events] = await Promise.all([fetchAllLearningUsers(supabase), fetchAllLearningEvents(supabase)]);

    const dateRange = resolveDateRange(range);
    const summary = computeSummaryMetrics({ users, events }, dateRange);
    res.status(200).json(summary);
  } catch (error) {
    console.error("GET /api/admin/summary failed", error);
    res.status(500).json({ error: "admin_summary_failed" });
  }
}
