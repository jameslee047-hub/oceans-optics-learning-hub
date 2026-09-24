// GET /api/admin/categories?range=today|7d|30d|all -- per-category
// engagement/progression using the published catalogue's real
// handles/titles. See lib/journey-analytics.js's computeCategoryPerformance
// for the exact metric definitions.
import { requireAdmin } from "../../lib/require-admin.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { fetchAllLearningEvents } from "../../lib/admin-data.js";
import { resolveDateRange, isWithinRange, computeTrackingStartedAt, LEARNING_CATALOGUE } from "../../lib/analytics-service.js";
import { computeCategoryPerformance } from "../../lib/journey-analytics.js";

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
    const events = await fetchAllLearningEvents(supabase);

    const dateRange = resolveDateRange(range);
    const eventsInRange = events.filter((event) => isWithinRange(event.created_at, dateRange));

    res.status(200).json({
      range: dateRange.range,
      categories: computeCategoryPerformance(LEARNING_CATALOGUE, eventsInRange),
      trackingStartedAt: computeTrackingStartedAt(events)
    });
  } catch (error) {
    console.error("GET /api/admin/categories failed", error);
    res.status(500).json({ error: "admin_categories_failed" });
  }
}
