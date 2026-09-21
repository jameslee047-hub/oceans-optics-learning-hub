// POST /api/customer-auth/exchange { handoff } -- called directly by the
// storefront bootstrap script (learning-hub-progress-auth.js) immediately
// after the Customer Account OAuth callback redirects back with a one-time
// opaque handoff code in the URL fragment. Exchanges that code for the
// existing short-lived Learning Progress JWT. See lib/auth-handoff.js and
// lib/customer-auth-exchange-service.js.
//
// Unauthenticated by design (the caller doesn't have a session token yet --
// that's the whole point), so it is deliberately narrow: POST only, a
// strict Content-Type, a basic code format/length check before any
// database work, and the same storefront-only CORS as every other
// browser-facing endpoint. The handoff value itself is never logged.
import { applyCors } from "../../lib/cors.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { consumeAuthHandoff, isValidHandoffCodeFormat } from "../../lib/auth-handoff.js";
import { mintSessionToken } from "../../lib/session-token.js";
import { exchangeAuthHandoff } from "../../lib/customer-auth-exchange-service.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const contentType = req.headers["content-type"] || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    res.status(415).json({ error: "unsupported_content_type" });
    return;
  }

  const body = req.body;
  if (typeof body !== "object" || body === null) {
    res.status(400).json({ error: "malformed_body" });
    return;
  }

  const { handoff } = body;
  // Cheap shape/length check before any database work -- never logs the
  // value either way, valid or not.
  if (!isValidHandoffCodeFormat(handoff)) {
    res.status(400).json({ error: "invalid_handoff" });
    return;
  }

  const result = await exchangeAuthHandoff({
    handoff,
    sessionTokenSecret: process.env.SESSION_TOKEN_SECRET,
    shopifyShopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    getSupabaseClient,
    consumeAuthHandoff,
    mintSessionToken
  });

  res.status(result.status).json(result.body);
}
