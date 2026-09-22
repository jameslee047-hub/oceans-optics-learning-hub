// Route-level tests for api/progress.js. As with lesson-viewed.test.js and
// quiz-result.test.js, only the auth-guard layer is exercised here (it
// returns before any database work); the actual read behaviour (correct
// scoping to one user, reflecting freshly written rows) is covered against
// a fake Supabase client in test/progress-service.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/progress.js";
import { mintSessionToken } from "../lib/session-token.js";
import { createMockNodeResponse, withEnv } from "./cookie-test-utils.js";

const SESSION_SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";

async function withAuthEnv(fn) {
  return withEnv({ SESSION_TOKEN_SECRET: SESSION_SECRET, SHOPIFY_SHOP_DOMAIN: SHOP }, fn);
}

test("rejects non-GET methods", async () => {
  const req = { method: "POST", headers: {} };
  const res = createMockNodeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.jsonBody.error, "method_not_allowed");
});

test("rejects a missing bearer token", async () => {
  await withAuthEnv(async () => {
    const req = { method: "GET", headers: {} };
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.jsonBody.error, "missing_bearer_token");
  });
});

test("rejects an expired bearer token", async () => {
  await withAuthEnv(async () => {
    const expired = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SESSION_SECRET, ttlSeconds: 60, now: () => 0 });
    const req = { method: "GET", headers: { authorization: `Bearer ${expired}` } };
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.jsonBody.error, "expired");
  });
});
