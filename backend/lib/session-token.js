// Mints and verifies the short-lived "Learning Progress" session token
// handed to the browser after a verified identity check (Customer Account
// OAuth; the App Proxy path in api/proxy/identity.js is diagnostic-only --
// see that file). Built on the generic signing primitive in signed-token.js;
// this file only adds the domain-specific claim shape and validation.
//
// Payload is deliberately minimal (zero PII): shopify_customer_id, shop,
// iat, exp. No email/name/address ever belongs in this token.
//
// shopify_customer_id is Shopify's numeric Admin customer ID, extracted
// (and GID-format-validated) from the Customer Account API's authenticated
// `customer { id }` query -- see lib/shopify-customer-gid.js and
// api/customer-auth/callback.js. It is NOT the OIDC `sub` claim: the ID
// token's `sub` is used only to cryptographically validate the OAuth flow
// itself and is never persisted or placed in this token.
import { signPayload, verifyPayloadSignature } from "./signed-token.js";

const DEFAULT_TTL_SECONDS = 30 * 60; // ~30 minutes, per spec

export function mintSessionToken({ shopifyCustomerId, shop, secret, ttlSeconds = DEFAULT_TTL_SECONDS, now = Date.now }) {
  if (!shopifyCustomerId) throw new Error("shopifyCustomerId is required to mint a session token");
  if (!shop) throw new Error("shop is required to mint a session token");

  return signPayload({ shopify_customer_id: String(shopifyCustomerId), shop }, secret, ttlSeconds, now);
}

// Returns { valid: true, payload } or { valid: false, reason }.
// `expectedShop` must be passed and checked -- a token minted for one shop
// must never be accepted for another (relevant once/if this backend ever
// serves more than one store).
export function verifySessionToken(token, { secret, expectedShop, now = Date.now }) {
  const result = verifyPayloadSignature(token, secret, now);
  if (!result.valid) return result;

  if (!result.payload.shopify_customer_id) {
    return { valid: false, reason: "missing_customer_id" };
  }

  if (expectedShop && result.payload.shop !== expectedShop) {
    return { valid: false, reason: "shop_mismatch" };
  }

  return { valid: true, payload: result.payload };
}
