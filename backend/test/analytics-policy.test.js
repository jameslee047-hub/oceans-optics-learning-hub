// Regression coverage for the Preview/dev analytics contamination fix (see
// the project report): behavioural analytics (learning_events writes) must
// only ever persist on confirmed Vercel Production traffic, while
// authenticated learner progress state (lesson_progress,
// knowledge_check_results, learning_users) must keep working identically
// in every environment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isBehavioralAnalyticsEnabled } from "../lib/analytics-policy.js";
import { createLearningEventHandler } from "../api/learning-event.js";
import { createQuizResultHandler } from "../api/quiz/result.js";
import { createLessonViewedHandler } from "../routes/lesson/viewed.js";
import { createLessonCompleteHandler } from "../routes/lesson/complete.js";
import { mintSessionToken } from "../lib/session-token.js";
import { createFakeSupabase } from "./fake-supabase.js";
import { createMockNodeResponse, withEnv } from "./cookie-test-utils.js";

const SESSION_SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";
const ANONYMOUS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function withAuthEnv(vars, fn) {
  return withEnv({ SESSION_TOKEN_SECRET: SESSION_SECRET, SHOPIFY_SHOP_DOMAIN: SHOP, ...vars }, fn);
}

function validToken() {
  return mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SESSION_SECRET });
}

function bearerRequest({ method = "POST", token, body } = {}) {
  return { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body };
}

// ---------------- isBehavioralAnalyticsEnabled itself ----------------

test("isBehavioralAnalyticsEnabled: true only for VERCEL_ENV=production", () => {
  assert.equal(isBehavioralAnalyticsEnabled({ VERCEL_ENV: "production" }), true);
});

test("isBehavioralAnalyticsEnabled: false for VERCEL_ENV=preview", () => {
  assert.equal(isBehavioralAnalyticsEnabled({ VERCEL_ENV: "preview" }), false);
});

test("isBehavioralAnalyticsEnabled: false for VERCEL_ENV=development", () => {
  assert.equal(isBehavioralAnalyticsEnabled({ VERCEL_ENV: "development" }), false);
});

test("isBehavioralAnalyticsEnabled: false when VERCEL_ENV is entirely unset (local/dev without Vercel)", () => {
  assert.equal(isBehavioralAnalyticsEnabled({}), false);
});

test("isBehavioralAnalyticsEnabled: false for an unrecognized value -- never opt-in by default", () => {
  assert.equal(isBehavioralAnalyticsEnabled({ VERCEL_ENV: "Production" }), false);
  assert.equal(isBehavioralAnalyticsEnabled({ VERCEL_ENV: "prod" }), false);
});

// ---------------- api/learning-event.js (anonymous + authenticated) ----------------

test("learning-event: preview -- anonymous behavioural analytics is NOT persisted, response still reports success", async () => {
  const supabase = createFakeSupabase();
  const handler = createLearningEventHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "preview" }) });
  const req = bearerRequest({ body: { event_type: "learning_hub_viewed", anonymous_visitor_id: ANONYMOUS_ID } });
  const res = createMockNodeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonBody.recorded, false);
  assert.equal(supabase.tables.learning_events?.length ?? 0, 0);
});

test("learning-event: development -- anonymous behavioural analytics is NOT persisted", async () => {
  const supabase = createFakeSupabase();
  const handler = createLearningEventHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "development" }) });
  const req = bearerRequest({ body: { event_type: "category_viewed", category_handle: "gear-masks-vision", anonymous_visitor_id: ANONYMOUS_ID } });
  const res = createMockNodeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(supabase.tables.learning_events?.length ?? 0, 0);
});

test("learning-event: unset VERCEL_ENV (local/dev) -- anonymous behavioural analytics is NOT persisted", async () => {
  const supabase = createFakeSupabase();
  const handler = createLearningEventHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({}) });
  const req = bearerRequest({ body: { event_type: "learning_hub_viewed", anonymous_visitor_id: ANONYMOUS_ID } });
  const res = createMockNodeResponse();
  await handler(req, res);

  assert.equal(supabase.tables.learning_events?.length ?? 0, 0);
});

test("learning-event: production -- anonymous behavioural analytics DOES persist normally", async () => {
  const supabase = createFakeSupabase();
  const handler = createLearningEventHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "production" }) });
  const req = bearerRequest({ body: { event_type: "learning_hub_viewed", anonymous_visitor_id: ANONYMOUS_ID } });
  const res = createMockNodeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonBody.recorded, true);
  assert.equal(supabase.tables.learning_events.length, 1);
  assert.equal(supabase.tables.learning_events[0].anonymous_visitor_id, ANONYMOUS_ID);
});

test("learning-event: preview -- authenticated behavioural analytics is NOT persisted, and no learning_users/last_seen_at touch happens either", async () => {
  await withAuthEnv({}, async () => {
    const supabase = createFakeSupabase();
    const handler = createLearningEventHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "preview" }) });
    const req = bearerRequest({ token: validToken(), body: { event_type: "learning_hub_viewed" } });
    const res = createMockNodeResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonBody.recorded, false);
    assert.equal(supabase.tables.learning_events?.length ?? 0, 0);
    assert.equal(supabase.tables.learning_users?.length ?? 0, 0, "the disabled short-circuit skips identity resolution entirely for this analytics-only endpoint");
  });
});

test("learning-event: production -- authenticated behavioural analytics persists correctly", async () => {
  await withAuthEnv({}, async () => {
    const supabase = createFakeSupabase();
    const handler = createLearningEventHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "production" }) });
    const req = bearerRequest({ token: validToken(), body: { event_type: "learning_hub_viewed" } });
    const res = createMockNodeResponse();
    await handler(req, res);

    assert.equal(res.jsonBody.recorded, true);
    assert.equal(supabase.tables.learning_events.length, 1);
  });
});

test("learning-event: request validation still runs (and still 400s) even when analytics is disabled -- the guard only skips the write, never the input checks", async () => {
  const supabase = createFakeSupabase();
  const handler = createLearningEventHandler({ getClient: async () => supabase, analyticsEnabled: () => false });
  const req = bearerRequest({ body: { event_type: "not_a_real_event_type", anonymous_visitor_id: ANONYMOUS_ID } });
  const res = createMockNodeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

// ---------------- api/quiz/result.js: state always persists, analytics is gated ----------------

test("quiz/result: preview -- score/completion STATE still saves, but no behavioural analytics event is recorded", async () => {
  await withAuthEnv({}, async () => {
    const supabase = createFakeSupabase();
    const handler = createQuizResultHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "preview" }) });
    const req = bearerRequest({ token: validToken(), body: { lesson_id: "R01", score: 1, total: 1 } });
    const res = createMockNodeResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(supabase.tables.knowledge_check_results.length, 1, "the real quiz score must still be saved in Preview");
    assert.equal(supabase.tables.lesson_progress[0].completed_at !== null, true, "lesson completion state must still save in Preview");
    assert.equal(supabase.tables.learning_events?.length ?? 0, 0, "no behavioural analytics event in Preview");
  });
});

test("quiz/result: production -- state saves AND both quiz_completed and lesson_completed analytics events are recorded", async () => {
  await withAuthEnv({}, async () => {
    const supabase = createFakeSupabase();
    const handler = createQuizResultHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "production" }) });
    const req = bearerRequest({ token: validToken(), body: { lesson_id: "R01", score: 1, total: 1 } });
    const res = createMockNodeResponse();
    await handler(req, res);

    assert.equal(supabase.tables.knowledge_check_results.length, 1);
    const eventTypes = supabase.tables.learning_events.map((e) => e.event_type).sort();
    assert.deepEqual(eventTypes, ["lesson_completed", "quiz_completed"]);
  });
});

test("quiz/result: development -- state saves, no analytics event", async () => {
  await withAuthEnv({}, async () => {
    const supabase = createFakeSupabase();
    const handler = createQuizResultHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "development" }) });
    const req = bearerRequest({ token: validToken(), body: { lesson_id: "R01", score: 1, total: 1 } });
    const res = createMockNodeResponse();
    await handler(req, res);

    assert.equal(supabase.tables.knowledge_check_results.length, 1);
    assert.equal(supabase.tables.learning_events?.length ?? 0, 0);
  });
});

// ---------------- routes/lesson/viewed.js: state always persists, analytics is gated ----------------

test("lesson/viewed: preview -- 'viewed' progress state still saves, no behavioural analytics event", async () => {
  await withAuthEnv({}, async () => {
    const supabase = createFakeSupabase();
    const handler = createLessonViewedHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "preview" }) });
    const req = bearerRequest({ token: validToken(), body: { lesson_id: "R01" } });
    const res = createMockNodeResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(supabase.tables.lesson_progress.length, 1, "the real 'viewed' state must still be saved in Preview");
    assert.equal(supabase.tables.learning_events?.length ?? 0, 0);
  });
});

test("lesson/viewed: production -- state saves and lesson_viewed analytics event is recorded", async () => {
  await withAuthEnv({}, async () => {
    const supabase = createFakeSupabase();
    const handler = createLessonViewedHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "production" }) });
    const req = bearerRequest({ token: validToken(), body: { lesson_id: "R01" } });
    const res = createMockNodeResponse();
    await handler(req, res);

    assert.equal(supabase.tables.lesson_progress.length, 1);
    assert.equal(supabase.tables.learning_events.length, 1);
    assert.equal(supabase.tables.learning_events[0].event_type, "lesson_viewed");
  });
});

// ---------------- routes/lesson/complete.js: state always persists, analytics is gated ----------------

test("lesson/complete: preview -- completion STATE still saves, no behavioural analytics event", async () => {
  await withAuthEnv({}, async () => {
    const supabase = createFakeSupabase();
    const handler = createLessonCompleteHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "preview" }) });
    const req = bearerRequest({ token: validToken(), body: { lesson_id: "R01" } });
    const res = createMockNodeResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(supabase.tables.lesson_progress[0].completed_at !== null, true, "completion state must still save in Preview");
    assert.equal(supabase.tables.learning_events?.length ?? 0, 0);
  });
});

test("lesson/complete: production -- state saves and lesson_completed analytics event is recorded on a genuinely new completion", async () => {
  await withAuthEnv({}, async () => {
    const supabase = createFakeSupabase();
    const handler = createLessonCompleteHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "production" }) });
    const req = bearerRequest({ token: validToken(), body: { lesson_id: "R01" } });
    const res = createMockNodeResponse();
    await handler(req, res);

    assert.equal(supabase.tables.learning_events.length, 1);
    assert.equal(supabase.tables.learning_events[0].event_type, "lesson_completed");
  });
});

test("lesson/complete: production -- a retake of an already-complete lesson saves no duplicate analytics event, matching production's existing idempotency", async () => {
  await withAuthEnv({}, async () => {
    const supabase = createFakeSupabase();
    const handler = createLessonCompleteHandler({ getClient: async () => supabase, analyticsEnabled: () => isBehavioralAnalyticsEnabled({ VERCEL_ENV: "production" }) });
    const token = validToken();
    await handler(bearerRequest({ token, body: { lesson_id: "R01" } }), createMockNodeResponse());
    await handler(bearerRequest({ token, body: { lesson_id: "R01" } }), createMockNodeResponse());

    assert.equal(supabase.tables.learning_events.length, 1, "already_complete must still gate the second call, exactly as in production today");
  });
});
