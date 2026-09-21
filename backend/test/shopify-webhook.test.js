import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyWebhookHmac } from "../lib/shopify-webhook.js";

const SECRET = "test-webhook-secret";

function sign(body) {
  return crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
}

test("accepts a correctly signed webhook body", () => {
  const body = JSON.stringify({ customer: { id: 555000111 } });
  const valid = verifyWebhookHmac(body, sign(body), SECRET);
  assert.equal(valid, true);
});

test("rejects a tampered body even with the original signature", () => {
  const originalBody = JSON.stringify({ customer: { id: 555000111 } });
  const signature = sign(originalBody);
  const tamperedBody = JSON.stringify({ customer: { id: 999999999 } });
  assert.equal(verifyWebhookHmac(tamperedBody, signature, SECRET), false);
});

test("rejects a missing signature header", () => {
  const body = JSON.stringify({ customer: { id: 555000111 } });
  assert.equal(verifyWebhookHmac(body, undefined, SECRET), false);
});

test("rejects a signature produced with the wrong secret", () => {
  const body = JSON.stringify({ customer: { id: 555000111 } });
  const wrongSignature = crypto.createHmac("sha256", "wrong-secret").update(body, "utf8").digest("base64");
  assert.equal(verifyWebhookHmac(body, wrongSignature, SECRET), false);
});
