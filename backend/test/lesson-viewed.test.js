// Route-level tests for api/lesson/viewed.js. Only the request-validation
// layer is exercised here (auth guard + payload shape) -- both branches
// return before ever calling getSupabaseClient(), so these need no real
// database. The actual write/idempotency behaviour once a valid session
// and lesson_id reach lib/progress-service.js is already covered
// end-to-end against a fake Supabase client in test/progress-service.test.js,
// mirroring how the OAuth callback's route vs. service split is tested
// elsewhere in this suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/lesson/viewed.js";
import { mintSessionToken } from "../lib/session-token.js";
import { createMockNodeResponse, withEnv } from "./cookie-test-utils.js";

const SESSION_SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";

function bearerRequest({ method = "POST", token, body } = {}) {
  return {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body
  };
}

async function withAuthEnv(fn) {
  return withEnv({ SESSION_TOKEN_SECRET: SESSION_SECRET, SHOPIFY_SHOP_DOMAIN: SHOP }, fn);
}

test("rejects non-POST methods", async () => {
  const req = bearerRequest({ method: "GET" });
  const res = createMockNodeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.jsonBody.error, "method_not_allowed");
});

test("rejects a missing bearer token", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ body: { lesson_id: "R01" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.jsonBody.error, "missing_bearer_token");
  });
});

test("rejects an invalid (malformed) bearer token", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: "not-a-real-token", body: { lesson_id: "R01" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  });
});

test("rejects an expired bearer token", async () => {
  await withAuthEnv(async () => {
    const expired = mintSessionToken({
      shopifyCustomerId: "555000111",
      shop: SHOP,
      secret: SESSION_SECRET,
      ttlSeconds: 60,
      now: () => 0 // 1970 -- guaranteed expired relative to the real clock requireSession checks against
    });
    const req = bearerRequest({ token: expired, body: { lesson_id: "R01" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.jsonBody.error, "expired");
  });
});

test("rejects a bearer token minted for a different shop", async () => {
  await withAuthEnv(async () => {
    const wrongShop = mintSessionToken({ shopifyCustomerId: "555000111", shop: "other-shop.myshopify.com", secret: SESSION_SECRET });
    const req = bearerRequest({ token: wrongShop, body: { lesson_id: "R01" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.jsonBody.error, "shop_mismatch");
  });
});

test("rejects a missing lesson_id before any database work", async () => {
  await withAuthEnv(async () => {
    const token = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SESSION_SECRET });
    const req = bearerRequest({ token, body: {} });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "invalid_lesson_id");
  });
});

test("rejects a lesson_id that isn't the internal R## shape (e.g. a public handle)", async () => {
  await withAuthEnv(async () => {
    const token = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SESSION_SECRET });
    const req = bearerRequest({ token, body: { lesson_id: "choosing-a-mask" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "invalid_lesson_id");
  });
});
