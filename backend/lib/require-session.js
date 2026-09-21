// Shared bearer-token auth guard for the direct (non-proxy) endpoints.
// Returns the verified session payload, or writes a 401 and returns null.
// This is the ONLY source of `shopify_customer_id` these endpoints ever
// use -- a request body/query value is never trusted for identity.
import { verifySessionToken } from "./session-token.js";

export function requireSession(req, res) {
  const authHeader = req.headers.authorization || "";
  const match = /^Bearer (.+)$/.exec(authHeader);
  if (!match) {
    res.status(401).json({ error: "missing_bearer_token" });
    return null;
  }

  const result = verifySessionToken(match[1], {
    secret: process.env.SESSION_TOKEN_SECRET,
    expectedShop: process.env.SHOPIFY_SHOP_DOMAIN
  });

  if (!result.valid) {
    res.status(401).json({ error: result.reason });
    return null;
  }

  return result.payload;
}
