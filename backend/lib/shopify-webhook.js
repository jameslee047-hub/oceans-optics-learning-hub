// Verifies a Shopify webhook's `X-Shopify-Hmac-Sha256` header.
//
// Different algorithm from App Proxy verification (shopify-app-proxy.js):
// this HMACs the RAW request body bytes (never the parsed/re-serialized
// JSON -- re-serializing can reorder keys or change whitespace and silently
// break verification), base64-encodes, and compares to the header.
//
// `rawBody` must be the exact bytes Shopify sent (a Buffer or the exact
// string), captured before any JSON.parse.
import crypto from "node:crypto";

export function verifyWebhookHmac(rawBody, hmacHeader, appSecret) {
  if (!hmacHeader || typeof hmacHeader !== "string") return false;

  const digest = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("base64");

  const providedBuffer = Buffer.from(hmacHeader, "base64");
  const expectedBuffer = Buffer.from(digest, "base64");

  return (
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  );
}
