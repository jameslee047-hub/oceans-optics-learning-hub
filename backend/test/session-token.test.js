import { test } from "node:test";
import assert from "node:assert/strict";
import { mintSessionToken, verifySessionToken } from "../lib/session-token.js";

const SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";

test("mints a token that verifies successfully", () => {
  const token = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SECRET });
  const result = verifySessionToken(token, { secret: SECRET, expectedShop: SHOP });
  assert.equal(result.valid, true);
  assert.equal(result.payload.shopify_customer_id, "555000111");
  assert.equal(result.payload.shop, SHOP);
});

test("token payload contains only the documented minimal fields (zero PII)", () => {
  const token = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SECRET });
  const [, encodedPayload] = token.split(".");
  const payload = JSON.parse(Buffer.from(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  assert.deepEqual(Object.keys(payload).sort(), ["exp", "iat", "shop", "shopify_customer_id"]);
});

test("rejects an expired token", () => {
  const fixedNow = () => 1_700_000_000_000;
  const token = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SECRET, ttlSeconds: 60, now: fixedNow });
  const later = () => fixedNow() + 61_000; // 61 seconds later
  const result = verifySessionToken(token, { secret: SECRET, expectedShop: SHOP, now: later });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "expired");
});

test("accepts a token right up to, but not past, its expiry", () => {
  const fixedNow = () => 1_700_000_000_000;
  const token = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SECRET, ttlSeconds: 1800, now: fixedNow });
  const justBefore = () => fixedNow() + 1799_000;
  const result = verifySessionToken(token, { secret: SECRET, expectedShop: SHOP, now: justBefore });
  assert.equal(result.valid, true);
});

test("rejects a token verified with the wrong secret", () => {
  const token = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SECRET });
  const result = verifySessionToken(token, { secret: "wrong-secret", expectedShop: SHOP });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_signature");
});

test("rejects a token minted for a different shop", () => {
  const token = mintSessionToken({ shopifyCustomerId: "555000111", shop: "other-shop.myshopify.com", secret: SECRET });
  const result = verifySessionToken(token, { secret: SECRET, expectedShop: SHOP });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "shop_mismatch");
});

test("rejects a forged token: attacker edits the payload without knowing the secret", () => {
  const token = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SECRET });
  const [header, payload, signature] = token.split(".");
  const forgedPayload = Buffer.from(
    JSON.stringify({ shopify_customer_id: "999999999", shop: SHOP, iat: 0, exp: 9_999_999_999 })
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const forgedToken = `${header}.${forgedPayload}.${signature}`;

  const result = verifySessionToken(forgedToken, { secret: SECRET, expectedShop: SHOP });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_signature");
});

test("rejects a malformed token", () => {
  const result = verifySessionToken("not-a-real-token", { secret: SECRET, expectedShop: SHOP });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "malformed_token");
});

test("rejects a missing token", () => {
  const result = verifySessionToken(undefined, { secret: SECRET, expectedShop: SHOP });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "missing_token");
});
