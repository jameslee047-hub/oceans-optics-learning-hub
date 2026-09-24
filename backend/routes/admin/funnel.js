// GET /api/admin/funnel?range=today|7d|30d|all -- ordered Learning Hub
// funnel, direct-entrant totals, continue-learning behaviour, and
// within-period repeat-visit detail. See lib/journey-analytics.js for the
// exact cohort/ordering/period definitions -- this route only fetches data
// and wires it together.
import { requireAdmin } from "../../lib/require-admin.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { fetchAllLearningEvents } from "../../lib/admin-data.js";
import { resolveDateRange, isWithinRange, computeTrackingStartedAt } from "../../lib/analytics-service.js";
import {
  computeLearningHubFunnel,
  computeDirectEntrants,
  computeContinueLearning,
  computeReturningVisitorDetail
} from "../../lib/journey-analytics.js";

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
      funnel: computeLearningHubFunnel(eventsInRange),
      directEntrants: computeDirectEntrants(eventsInRange),
      continueLearning: computeContinueLearning(eventsInRange),
      returningDetail: computeReturningVisitorDetail(eventsInRange),
      trackingStartedAt: computeTrackingStartedAt(events),
      anonymousTrackingStartedAt: computeTrackingStartedAt(events.filter((event) => event.anonymous_visitor_id)),
      hasEventData: events.length > 0
    });
  } catch (error) {
    console.error("GET /api/admin/funnel failed", error);
    res.status(500).json({ error: "admin_funnel_failed" });
  }
}
