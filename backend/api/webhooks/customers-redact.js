// POST webhook: customers/redact
//
// Fired when a customer requests deletion of their data (or 10 days after
// account deletion). Per the zero-PII design, deleting the learning_users
// row is the ENTIRE redaction: it holds nothing but a Shopify customer ID,
// and ON DELETE CASCADE removes lesson_progress + knowledge_check_results
// with it. There is no other Learning Hub data anywhere about this customer.
//
// This payload identifies the customer by `customer.id`, Shopify's numeric
// Admin API customer ID -- which is exactly what learning_users is keyed by
// (see the Phase A.2 correction: identity stays shopify_customer_id, the
// numeric ID obtained via the Customer Account API's `customer { id }`
// query, not the OIDC `sub`), so no mapping problem exists here.
import { readRawBody } from "../../lib/read-raw-body.js";
import { verifyWebhookHmac } from "../../lib/shopify-webhook.js";
import { getSupabaseClient, deleteLearningUserByShopifyCustomerId } from "../../lib/supabase.js";

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

  const shopifyCustomerId = payload.customer?.id;
  if (!shopifyCustomerId) {
    // Nothing to redact -- acknowledge so Shopify doesn't retry forever.
    res.status(200).json({ redacted: false, reason: "no_customer_id_in_payload" });
    return;
  }

  try {
    const supabase = await getSupabaseClient();
    await deleteLearningUserByShopifyCustomerId(supabase, shopifyCustomerId);
    res.status(200).json({ redacted: true });
  } catch (error) {
    console.error("customers/redact failed", error);
    res.status(500).json({ error: "redaction_failed" });
  }
}
