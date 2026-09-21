// DIAGNOSTIC ONLY as of Phase A.2 -- no longer the production identity
// mechanism. See the Phase A.2 report: once a customer is routed through
// New Customer Accounts' myaccount.oceansoptics.com environment, this App
// Proxy path was found on the real store to not reliably surface
// `logged_in_customer_id` for a logged-in customer. Production identity is
// now GET /api/customer-auth/start + /callback (Customer Account API OAuth
// 2.0 + PKCE, which independently obtains the same numeric
// shopify_customer_id via an authenticated `customer { id }` query -- see
// lib/shopify-customer-gid.js). This endpoint is kept only so the
// known-unreliable App Proxy behavior remains directly inspectable, and is
// left unmodified in exactly what it was already known to do: logged-out
// returns {"authenticated":false}.
//
// Deliberately no longer calls findOrCreateLearningUser or mints a session
// token, even though (unlike the since-reverted OIDC-subject design) the
// numeric `logged_in_customer_id` App Proxy supplies IS the same
// shopify_customer_id learning_users is keyed by: this path is still not
// trustworthy enough to build on (that's the whole reason the OAuth flow
// exists), so it stays a pure, side-effect-free diagnostic rather than a
// second, less-reliable write path into the same table.
import { verifyAppProxyRequest } from "../../lib/shopify-app-proxy.js";

export default async function handler(req, res) {
  const verification = verifyAppProxyRequest(req.query, process.env.SHOPIFY_API_SECRET);

  if (!verification.valid) {
    // Never distinguish "bad signature" from "no signature" in the response
    // -- both just mean "not a trustworthy Shopify request."
    res.status(401).json({ error: "invalid_proxy_signature" });
    return;
  }

  res.status(200).json({ authenticated: Boolean(verification.loggedInCustomerId) });
}
