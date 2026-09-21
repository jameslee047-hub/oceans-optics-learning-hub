// POST webhook: shop/redact
//
// Fired ~48 hours after the app is uninstalled from the shop. Removes every
// row belonging to this shop's customers. Since V1 only ever serves one
// shop (SHOPIFY_SHOP_DOMAIN), and learning_users has no shop column (it
// would be redundant for a single-tenant backend), this deletes everything.
// If this backend ever serves more than one shop, learning_users must grow
// a shop column FIRST and this handler must filter by it -- deleting
// everything would then be wrong.
import { readRawBody } from "../../lib/read-raw-body.js";
import { verifyWebhookHmac } from "../../lib/shopify-webhook.js";
import { getSupabaseClient } from "../../lib/supabase.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const rawBody = await readRawBody(req);
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  if (!verifyWebhookHmac(rawBody, hmacHeader, process.env.SHOPIFY_API_SECRET)) {
    res.status(401).json({ error: "invalid_webhook_signature" });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    res.status(400).json({ error: "invalid_json" });
    return;
  }

  if (payload.shop_domain && payload.shop_domain !== process.env.SHOPIFY_SHOP_DOMAIN) {
    res.status(200).json({ redacted: false, reason: "shop_domain_mismatch" });
    return;
  }

  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from("learning_users").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
    res.status(200).json({ redacted: true });
  } catch (error) {
    console.error("shop/redact failed", error);
    res.status(500).json({ error: "redaction_failed" });
  }
}
