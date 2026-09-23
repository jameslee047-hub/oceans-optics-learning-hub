// Route-level tests for api/learning-event.js -- same rationale as
// test/lesson-viewed.test.js: only the auth guard + payload validation
// layer is exercised here (all return before any database work); the
// actual deduped write behaviour is covered end-to-end against a fake
// Supabase client in test/analytics-service.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/learning-event.js";
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

function validToken() {
  return mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SESSION_SECRET });
}

test("rejects non-POST methods", async () => {
  const req = bearerRequest({ method: "GET" });
  const res = createMockNodeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});

test("rejects a missing bearer token", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ body: { event_type: "learning_hub_viewed" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  });
});

test("rejects an unknown event_type", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { event_type: "arbitrary_click" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "invalid_event_type");
  });
});

test("rejects lesson_viewed -- it is not client-reportable through this endpoint (already recorded server-side)", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { event_type: "lesson_viewed" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "invalid_event_type");
  });
});

test("rejects quiz_completed -- it is not client-reportable through this endpoint either", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { event_type: "quiz_completed" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
  });
});

test("rejects category_viewed with a missing category_handle", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { event_type: "category_viewed" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "invalid_category_handle");
  });
});

test("rejects category_viewed with a category_handle that isn't a real published category", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { event_type: "category_viewed", category_handle: "not-a-real-category" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "invalid_category_handle");
  });
});

test("accepts learning_hub_viewed (reaches the unset-Supabase boundary, not a validation error)", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { event_type: "learning_hub_viewed" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.notEqual(res.statusCode, 400);
    assert.notEqual(res.statusCode, 401);
  });
});

test("accepts progress_dashboard_viewed", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { event_type: "progress_dashboard_viewed" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.notEqual(res.statusCode, 400);
    assert.notEqual(res.statusCode, 401);
  });
});

test("accepts category_viewed with a real category_handle", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { event_type: "category_viewed", category_handle: "gear-masks-vision" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.notEqual(res.statusCode, 400);
    assert.notEqual(res.statusCode, 401);
  });
});
