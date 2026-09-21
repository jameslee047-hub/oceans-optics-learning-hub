// Verifies a Shopify App Proxy request's `signature` query parameter.
//
// Shopify's documented algorithm (https://shopify.dev/docs/apps/build/online-store/blocks/proxies
// -- "Calculating a digital signature"): take every query parameter EXCEPT
// `signature`, sort by key, join repeated keys' values with a comma, and
// concatenate as `key=value` pairs with NO separator between pairs (not the
// usual `&`). HMAC-SHA256 that string with the app's client secret, hex
// encode, and compare (constant-time) to `signature`.
//
// This is a different algorithm from Shopify webhook verification (which
// HMACs the raw request body and base64-encodes) -- see shopify-webhook.js.
// Never confuse the two.
import crypto from "node:crypto";

export function computeAppProxySignature(queryParams, appSecret) {
  const message = Object.keys(queryParams)
    .filter((key) => key !== "signature")
    .sort()
    .map((key) => {
      const value = queryParams[key];
      const joined = Array.isArray(value) ? value.join(",") : value;
      return `${key}=${joined}`;
    })
    .join("");

  return crypto.createHmac("sha256", appSecret).update(message, "utf8").digest("hex");
}

// Returns { valid: boolean, loggedInCustomerId: string | null, shop: string | null }.
// `loggedInCustomerId` is only ever populated when `valid` is true -- callers
// must check `valid` first and never read identity out of an unverified request.
export function verifyAppProxyRequest(queryParams, appSecret) {
  const providedSignature = queryParams.signature;
  if (!providedSignature || typeof providedSignature !== "string") {
    return { valid: false, loggedInCustomerId: null, shop: null };
  }

  const expectedSignature = computeAppProxySignature(queryParams, appSecret);

  const providedBuffer = Buffer.from(providedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const valid =
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!valid) {
    return { valid: false, loggedInCustomerId: null, shop: null };
  }

  const loggedInCustomerId =
    typeof queryParams.logged_in_customer_id === "string" && queryParams.logged_in_customer_id.length > 0
      ? queryParams.logged_in_customer_id
      : null;

  return {
    valid: true,
    loggedInCustomerId,
    shop: typeof queryParams.shop === "string" ? queryParams.shop : null
  };
}
