// Mints and verifies the short-lived "Learning Progress" session token
// handed to the browser after a verified Shopify App Proxy identity check
// (see api/proxy/identity.js). This is a minimal hand-rolled HS256 JWT --
// no external dependency -- since the payload and validation rules are
// small and fixed. Do not extend this into a general-purpose JWT library.
//
// Payload is deliberately minimal (zero PII): shopify_customer_id, shop,
// iat, exp. No email/name/address ever belongs in this token.
import crypto from "node:crypto";

const DEFAULT_TTL_SECONDS = 30 * 60; // ~30 minutes, per spec

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

export function mintSessionToken({ shopifyCustomerId, shop, secret, ttlSeconds = DEFAULT_TTL_SECONDS, now = Date.now }) {
  if (!shopifyCustomerId) throw new Error("shopifyCustomerId is required to mint a session token");
  if (!shop) throw new Error("shop is required to mint a session token");
  if (!secret) throw new Error("secret is required to mint a session token");

  const iat = Math.floor(now() / 1000);
  const exp = iat + ttlSeconds;

  const header = { alg: "HS256", typ: "JWT" };
  const payload = { shopify_customer_id: String(shopifyCustomerId), shop, iat, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", secret).update(signingInput).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

// Returns { valid: true, payload } or { valid: false, reason }.
// `expectedShop` must be passed and checked -- a token minted for one shop
// must never be accepted for another (relevant once/if this backend ever
// serves more than one store).
export function verifySessionToken(token, { secret, expectedShop, now = Date.now }) {
  if (!token || typeof token !== "string") return { valid: false, reason: "missing_token" };

  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, reason: "malformed_token" };
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(signingInput).digest();
  const providedSignature = base64UrlDecode(encodedSignature);

  const signatureValid =
    providedSignature.length === expectedSignature.length &&
    crypto.timingSafeEqual(providedSignature, expectedSignature);
  if (!signatureValid) return { valid: false, reason: "invalid_signature" };

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));
  } catch (error) {
    return { valid: false, reason: "invalid_payload" };
  }

  const nowSeconds = Math.floor(now() / 1000);
  if (typeof payload.exp !== "number" || nowSeconds >= payload.exp) {
    return { valid: false, reason: "expired" };
  }

  if (!payload.shopify_customer_id) {
    return { valid: false, reason: "missing_customer_id" };
  }

  if (expectedShop && payload.shop !== expectedShop) {
    return { valid: false, reason: "shop_mismatch" };
  }

  return { valid: true, payload };
}
