// POST webhook: customers/data_request
//
// Fired when a customer asks the merchant for a copy of their data. Shopify
// expects the app to make the data available to the merchant (not to
// respond synchronously with the payload) -- typically by emailing it or
// making it retrievable. For V1, this logs a structured record of exactly
// what Learning Hub data exists for the customer so James can fulfil the
// request manually; wiring an automatic export/email is a later
// enhancement, not required to pass this webhook.
//
// This payload identifies the customer by `customer.id`, Shopify's numeric
// Admin API customer ID -- which is exactly what learning_users is keyed
// by, so it maps directly with no ambiguity.
import { readRawBody } from "../../lib/read-raw-body.js";
import { verifyWebhookHmac } from "../../lib/shopify-webhook.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { getProgress } from "../../lib/progress-service.js";

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
    res.status(200).json({ exported: false, reason: "no_customer_id_in_payload" });
    return;
  }

  try {
    const supabase = await getSupabaseClient();
    // Deliberately does not create a row for a customer with none -- a data
    // request must never itself cause us to start tracking someone.
    const { data: existing } = await supabase
      .from("learning_users")
      .select("id")
      .eq("shopify_customer_id", shopifyCustomerId)
      .maybeSingle();

    const progress = existing ? await getProgress(supabase, existing.id) : { lessons: [], quizzes: [] };

    // Structured log only for V1 -- James fulfils the request manually from
    // this record. No email/name/address is ever present because none is
    // stored.
    console.log("customers/data_request", { shopifyCustomerId, progress });
    res.status(200).json({ exported: true });
  } catch (error) {
    console.error("customers/data_request failed", error);
    res.status(500).json({ error: "data_request_failed" });
  }
}
