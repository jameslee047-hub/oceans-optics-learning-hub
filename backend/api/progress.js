// GET /api/progress -- called directly by storefront JS (not via App Proxy)
// with `Authorization: Bearer <session token>`. Returns only the calling
// customer's own data; userId comes from the verified token, never from a
// query parameter.
import { applyCors } from "../lib/cors.js";
import { requireSession } from "../lib/require-session.js";
import { getSupabaseClient, findOrCreateLearningUser } from "../lib/supabase.js";
import { getProgress } from "../lib/progress-service.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const session = requireSession(req, res);
  if (!session) return;

  try {
    const supabase = await getSupabaseClient();
    const userId = await findOrCreateLearningUser(supabase, session.shopify_customer_id);
    const progress = await getProgress(supabase, userId);
    res.status(200).json(progress);
  } catch (error) {
    console.error("GET /api/progress failed", error);
    res.status(500).json({ error: "progress_lookup_failed" });
  }
}
