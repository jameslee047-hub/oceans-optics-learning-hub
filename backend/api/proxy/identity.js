// Shopify App Proxy target for GET https://oceansoptics.com/apps/learning-progress/identity
//
// Shopify intercepts that storefront request, checks the customer's
// existing storefront session, and forwards it here (server-to-server) with
// `logged_in_customer_id` (empty if logged out), `shop`, `timestamp`, and a
// `signature` computed over every other query param -- see
// lib/shopify-app-proxy.js for the exact algorithm. This is the ONLY place
// in this backend that trusts a customer identity coming from Shopify; every
// other endpoint trusts only the session token minted here.
//
// No CORS headers here: Shopify calls this server-to-server, not the
// browser directly, so there is no cross-origin request to permit.
import { verifyAppProxyRequest } from "../../lib/shopify-app-proxy.js";
import { mintSessionToken } from "../../lib/session-token.js";
import { getSupabaseClient, findOrCreateLearningUser } from "../../lib/supabase.js";

export default async function handler(req, res) {
  const verification = verifyAppProxyRequest(req.query, process.env.SHOPIFY_API_SECRET);

  if (!verification.valid) {
    // Never distinguish "bad signature" from "no signature" in the response
    // -- both just mean "not a trustworthy Shopify request."
    res.status(401).json({ error: "invalid_proxy_signature" });
    return;
  }

  if (!verification.loggedInCustomerId) {
    res.status(200).json({ authenticated: false });
    return;
  }

  try {
    const supabase = await getSupabaseClient();
    await findOrCreateLearningUser(supabase, verification.loggedInCustomerId);

    const token = mintSessionToken({
      shopifyCustomerId: verification.loggedInCustomerId,
      shop: verification.shop || process.env.SHOPIFY_SHOP_DOMAIN,
      secret: process.env.SESSION_TOKEN_SECRET
    });

    res.status(200).json({ authenticated: true, token });
  } catch (error) {
    console.error("identity endpoint failed", error);
    res.status(500).json({ error: "identity_lookup_failed" });
  }
}
