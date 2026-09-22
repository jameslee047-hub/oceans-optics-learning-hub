// Route-level tests for api/quiz/result.js -- same rationale as
// test/lesson-viewed.test.js: only the auth guard + payload validation
// layer is exercised here (both return before any database work); the
// actual write/upsert/lesson-completion behaviour is covered end-to-end
// against a fake Supabase client in test/progress-service.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/quiz/result.js";
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
  assert.equal(res.jsonBody.error, "method_not_allowed");
});

test("rejects a missing bearer token", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ body: { lesson_id: "R08", score: 4, total: 5 } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.jsonBody.error, "missing_bearer_token");
  });
});

test("rejects an expired bearer token", async () => {
  await withAuthEnv(async () => {
    const expired = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SESSION_SECRET, ttlSeconds: 60, now: () => 0 });
    const req = bearerRequest({ token: expired, body: { lesson_id: "R08", score: 4, total: 5 } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.jsonBody.error, "expired");
  });
});

test("rejects a bearer token signed with the wrong secret", async () => {
  await withAuthEnv(async () => {
    const forged = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: "wrong-secret" });
    const req = bearerRequest({ token: forged, body: { lesson_id: "R08", score: 4, total: 5 } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  });
});

test("rejects a missing/malformed lesson_id before any database work", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { score: 4, total: 5 } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "invalid_lesson_id");
  });
});

test("rejects a public lesson handle where an internal lesson_id is required", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { lesson_id: "golden-rules-for-safer-snorkeling", score: 4, total: 5 } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "invalid_lesson_id");
  });
});

test("rejects a score greater than total before any database work", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { lesson_id: "R08", score: 9, total: 5 } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "score_cannot_exceed_total");
  });
});

test("rejects a non-integer score/total", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { lesson_id: "R08", score: "4", total: 5 } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "score_and_total_must_be_integers");
  });
});

test("rejects a negative score", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ token: validToken(), body: { lesson_id: "R08", score: -1, total: 5 } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "score_must_be_non_negative");
  });
});
