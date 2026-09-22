// Route-level tests proving every /api/admin/* endpoint (including the
// HTML dashboard shell itself) is actually gated by lib/require-admin.js,
// and that a customer Learning Progress bearer JWT grants it no access
// whatsoever. Matches the same "validation layer only, real DB path
// covered elsewhere" rationale as test/lesson-viewed.test.js and
// test/quiz-result.test.js: these stop at the auth boundary or the
// Supabase-not-configured boundary, never reaching a real database.
import { test } from "node:test";
import assert from "node:assert/strict";
import summaryHandler from "../api/admin/summary.js";
import lessonsHandler from "../api/admin/lessons.js";
import questionsHandler from "../api/admin/questions.js";
import learnersHandler from "../api/admin/learners.js";
import learnerDetailHandler from "../api/admin/learners/[id].js";
import indexHandler from "../api/admin/index.js";
import { mintSessionToken } from "../lib/session-token.js";
import { createMockNodeResponse, withEnv } from "./cookie-test-utils.js";

const ADMIN_USERNAME = "staff";
const ADMIN_PASSWORD = "correct-horse-battery-staple";
const SESSION_SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";

function withAdminEnv(fn) {
  return withEnv({ ADMIN_DASHBOARD_USERNAME: ADMIN_USERNAME, ADMIN_DASHBOARD_PASSWORD: ADMIN_PASSWORD }, fn);
}

function basicAuthHeader(username, password) {
  return "Basic " + Buffer.from(`${username}:${password}`, "utf8").toString("base64");
}

function customerBearerHeader() {
  const token = mintSessionToken({ shopifyCustomerId: "555000111", shop: SHOP, secret: SESSION_SECRET });
  return `Bearer ${token}`;
}

const ROUTES = [
  { name: "index (HTML dashboard)", handler: indexHandler, method: "GET", query: {} },
  { name: "summary", handler: summaryHandler, method: "GET", query: { range: "all" } },
  { name: "lessons", handler: lessonsHandler, method: "GET", query: {} },
  { name: "questions", handler: questionsHandler, method: "GET", query: {} },
  { name: "learners", handler: learnersHandler, method: "GET", query: {} },
  { name: "learners/[id]", handler: learnerDetailHandler, method: "GET", query: { id: "11111111-1111-1111-1111-111111111111" } }
];

for (const route of ROUTES) {
  test(`${route.name}: rejects a request with no admin credentials`, async () => {
    await withAdminEnv(async () => {
      const req = { method: route.method, headers: {}, query: route.query };
      const res = createMockNodeResponse();
      await route.handler(req, res);
      assert.equal(res.statusCode, 401);
    });
  });

  test(`${route.name}: rejects a customer Learning Progress bearer JWT -- it grants no admin access`, async () => {
    await withAdminEnv(async () => {
      const req = { method: route.method, headers: { authorization: customerBearerHeader() }, query: route.query };
      const res = createMockNodeResponse();
      await route.handler(req, res);
      assert.equal(res.statusCode, 401);
    });
  });

  test(`${route.name}: rejects wrong admin credentials`, async () => {
    await withAdminEnv(async () => {
      const req = { method: route.method, headers: { authorization: basicAuthHeader(ADMIN_USERNAME, "wrong") }, query: route.query };
      const res = createMockNodeResponse();
      await route.handler(req, res);
      assert.equal(res.statusCode, 401);
    });
  });

  test(`${route.name}: with correct admin credentials, proceeds past auth (reaches the unset-Supabase boundary, not a 401/403)`, async () => {
    await withAdminEnv(async () => {
      const req = { method: route.method, headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) }, query: route.query };
      const res = createMockNodeResponse();
      await route.handler(req, res);
      assert.notEqual(res.statusCode, 401);
      assert.notEqual(res.statusCode, 403);
    });
  });
}

test("summary/lessons/questions/learners/learners[id] reject non-GET methods (after auth)", async () => {
  await withAdminEnv(async () => {
    for (const route of ROUTES) {
      const req = { method: "POST", headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) }, query: route.query };
      const res = createMockNodeResponse();
      await route.handler(req, res);
      assert.equal(res.statusCode, 405, `${route.name} should reject POST`);
    }
  });
});

test("index route serves HTML, not JSON, once authorized", async () => {
  await withAdminEnv(async () => {
    const req = { method: "GET", headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) } };
    const res = createMockNodeResponse();
    indexHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.getHeader("Content-Type").includes("text/html"));
  });
});

test("learners/[id] rejects a missing/empty id before any database work", async () => {
  await withAdminEnv(async () => {
    const req = { method: "GET", headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) }, query: {} };
    const res = createMockNodeResponse();
    await learnerDetailHandler(req, res);
    assert.equal(res.statusCode, 400);
  });
});
