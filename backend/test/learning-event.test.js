// Route-level tests for api/learning-event.js -- same rationale as
// test/lesson-viewed.test.js: only the auth guard + payload validation
// layer is exercised here (all return before any database work); the
// actual deduped write behaviour is covered end-to-end against a fake
// Supabase client in test/analytics-service.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { createLearningEventHandler } from "../api/learning-event.js";
import { mintSessionToken } from "../lib/session-token.js";
import { createFakeSupabase } from "./fake-supabase.js";
import { createMockNodeResponse, withEnv } from "./cookie-test-utils.js";

const SESSION_SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";
const ANONYMOUS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

test("an anonymous request requires a valid visitor UUID", async () => {
  await withAuthEnv(async () => {
    const req = bearerRequest({ body: { event_type: "learning_hub_viewed" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "invalid_anonymous_visitor_id");
  });
});

test("rejects an invalid anonymous visitor ID", async () => {
  const req = bearerRequest({ body: { event_type: "learning_hub_viewed", anonymous_visitor_id: "not-a-uuid" } });
  const res = createMockNodeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.jsonBody.error, "invalid_anonymous_visitor_id");
});

test("anonymous clients cannot submit learning_user_id or PII fields", async () => {
  for (const forbidden of [
    { learning_user_id: "11111111-1111-1111-1111-111111111111" },
    { email: "person@example.com" },
    { name: "Person" },
    { user_agent: "fingerprint material" }
  ]) {
    const req = bearerRequest({
      body: { event_type: "learning_hub_viewed", anonymous_visitor_id: ANONYMOUS_ID, ...forbidden }
    });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody.error, "invalid_event_payload");
  }
});

test("anonymous clients cannot record progress dashboard views", async () => {
  const req = bearerRequest({ body: { event_type: "progress_dashboard_viewed", anonymous_visitor_id: ANONYMOUS_ID } });
  const res = createMockNodeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.jsonBody.error, "invalid_event_type");
});

async function recordAnonymous(body) {
  const supabase = createFakeSupabase();
  // Recording behaviour itself is under test here, independent of the
  // environment guard (see test/analytics-policy.test.js for that) -- so
  // analytics is explicitly forced on rather than left to default off in
  // this VERCEL_ENV-less test environment.
  const anonymousHandler = createLearningEventHandler({ getClient: async () => supabase, analyticsEnabled: () => true });
  const req = bearerRequest({ body: { anonymous_visitor_id: ANONYMOUS_ID, ...body } });
  const res = createMockNodeResponse();
  await anonymousHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonBody.recorded, true);
  assert.equal(supabase.tables.learning_events.length, 1);
  assert.equal(supabase.tables.learning_events[0].anonymous_visitor_id, ANONYMOUS_ID);
  assert.equal(supabase.tables.learning_users, undefined);
  assert.equal(supabase.tables.lesson_progress, undefined);
  assert.equal(supabase.tables.knowledge_check_results, undefined);
  return supabase.tables.learning_events[0];
}

test("records an anonymous Learning Hub visit without creating progress state", async () => {
  const event = await recordAnonymous({ event_type: "learning_hub_viewed" });
  assert.equal(event.event_type, "learning_hub_viewed");
});

test("records an anonymous category view with only its validated handle", async () => {
  const event = await recordAnonymous({ event_type: "category_viewed", category_handle: "gear-masks-vision" });
  assert.deepEqual(event.metadata, { category_handle: "gear-masks-vision" });
});

test("records an anonymous lesson view", async () => {
  const event = await recordAnonymous({ event_type: "lesson_viewed", lesson_id: "R01" });
  assert.equal(event.lesson_id, "R01");
});

test("records an anonymous quiz attempt with validated score and answer review", async () => {
  const answers = [{ question_id: "q1", question: "Q?", selected: "A", correct: "B", is_correct: false }];
  const event = await recordAnonymous({ event_type: "quiz_completed", lesson_id: "R01", score: 0, total: 1, answers });
  assert.deepEqual(event.metadata, { score: 0, total: 1, answers });
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
