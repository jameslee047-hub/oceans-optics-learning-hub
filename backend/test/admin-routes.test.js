// Route-level tests proving every path dispatched by the consolidated
// /api/admin/[...path] function (including the HTML dashboard shell) is
// actually gated by lib/require-admin.js,
// and that a customer Learning Progress bearer JWT grants it no access
// whatsoever. Matches the same "validation layer only, real DB path
// covered elsewhere" rationale as test/lesson-viewed.test.js and
// test/quiz-result.test.js: these stop at the auth boundary or the
// Supabase-not-configured boundary, never reaching a real database.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/admin/[...path].js";
import learnerDetailHandler from "../routes/admin/learners/[id].js";
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
  { name: "dashboard (HTML)", method: "GET", url: "/admin", query: {} },
  { name: "dashboard API alias (HTML)", method: "GET", url: "/api/admin", query: {} },
  { name: "summary", method: "GET", url: "/api/admin/summary?range=all", query: { range: "all" } },
  { name: "lessons", method: "GET", url: "/api/admin/lessons", query: {} },
  { name: "questions", method: "GET", url: "/api/admin/questions", query: {} },
  { name: "learners", method: "GET", url: "/api/admin/learners", query: {} },
  { name: "funnel", method: "GET", url: "/api/admin/funnel?range=all", query: { range: "all" } },
  { name: "categories", method: "GET", url: "/api/admin/categories?range=all", query: { range: "all" } },
  { name: "identity-diagnostics", method: "GET", url: "/api/admin/identity-diagnostics", query: {} },
  {
    name: "learners/[id]",
    method: "GET",
    url: "/api/admin/learners/11111111-1111-1111-1111-111111111111",
    query: {}
  }
];

for (const route of ROUTES) {
  test(`${route.name}: rejects a request with no admin credentials`, async () => {
    await withAdminEnv(async () => {
      const req = { method: route.method, headers: {}, url: route.url, query: route.query };
      const res = createMockNodeResponse();
      await handler(req, res);
      assert.equal(res.statusCode, 401);
    });
  });

  test(`${route.name}: rejects a customer Learning Progress bearer JWT -- it grants no admin access`, async () => {
    await withAdminEnv(async () => {
      const req = { method: route.method, headers: { authorization: customerBearerHeader() }, url: route.url, query: route.query };
      const res = createMockNodeResponse();
      await handler(req, res);
      assert.equal(res.statusCode, 401);
    });
  });

  test(`${route.name}: rejects wrong admin credentials`, async () => {
    await withAdminEnv(async () => {
      const req = {
        method: route.method,
        headers: { authorization: basicAuthHeader(ADMIN_USERNAME, "wrong") },
        url: route.url,
        query: route.query
      };
      const res = createMockNodeResponse();
      await handler(req, res);
      assert.equal(res.statusCode, 401);
    });
  });

  test(`${route.name}: with correct admin credentials, proceeds past auth (reaches the unset-Supabase boundary, not a 401/403)`, async () => {
    await withAdminEnv(async () => {
      const req = {
        method: route.method,
        headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) },
        url: route.url,
        query: route.query
      };
      const res = createMockNodeResponse();
      await handler(req, res);
      assert.notEqual(res.statusCode, 401);
      assert.notEqual(res.statusCode, 403);
    });
  });
}

test("summary/lessons/questions/learners/learners[id] reject non-GET methods (after auth)", async () => {
  await withAdminEnv(async () => {
    for (const route of ROUTES) {
      const req = {
        method: "POST",
        headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) },
        url: route.url,
        query: route.query
      };
      const res = createMockNodeResponse();
      await handler(req, res);
      assert.equal(res.statusCode, 405, `${route.name} should reject POST`);
    }
  });
});

test("dashboard routes serve HTML, not JSON, once authorized", async () => {
  await withAdminEnv(async () => {
    for (const url of ["/admin", "/api/admin", "/api/admin/dashboard"]) {
      const req = {
        method: "GET",
        headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) },
        url,
        query: {}
      };
      const res = createMockNodeResponse();
      await handler(req, res);
      assert.equal(res.statusCode, 200);
      assert.ok(res.getHeader("Content-Type").includes("text/html"));
    }
  });
});

test("admin API URLs dispatch JSON handlers when Vercel does not populate query.path", async () => {
  const routes = [
    ["/api/admin/summary?range=all", { range: "all" }, "admin_summary_failed"],
    ["/api/admin/lessons", {}, "admin_lessons_failed"],
    ["/api/admin/questions", {}, "admin_questions_failed"],
    ["/api/admin/learners", {}, "admin_learners_failed"],
    ["/api/admin/learners/11111111-1111-1111-1111-111111111111", {}, "admin_learner_detail_failed"],
    ["/api/admin/funnel?range=all", { range: "all" }, "admin_funnel_failed"],
    ["/api/admin/categories?range=all", { range: "all" }, "admin_categories_failed"]
  ];

  await withAdminEnv(async () => {
    for (const [url, query, expectedError] of routes) {
      const req = {
        method: "GET",
        headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) },
        url,
        query
      };
      const res = createMockNodeResponse();
      await handler(req, res);
      assert.equal(res.getHeader("Content-Type"), undefined, `${url} must not serve dashboard HTML`);
      assert.equal(res.jsonBody?.error, expectedError, `${url} should reach its JSON route handler`);
    }
  });
});

test("the request URL is authoritative over a transformed or conflicting catch-all query value", async () => {
  await withAdminEnv(async () => {
    const req = {
      method: "GET",
      headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) },
      url: "/api/admin/summary?range=all",
      query: { path: ["dashboard"], range: "all" }
    };
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.jsonBody?.error, "admin_summary_failed");
    assert.equal(res.getHeader("Content-Type"), undefined);
  });
});

test("empty catch-all path also dispatches the HTML dashboard for local compatibility", async () => {
  await withAdminEnv(async () => {
    const req = {
      method: "GET",
      headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) },
      query: {}
    };
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.getHeader("Content-Type").includes("text/html"));
  });
});

test("unknown admin paths remain authenticated and return a scoped 404", async () => {
  await withAdminEnv(async () => {
    const unauthorized = createMockNodeResponse();
    await handler({ method: "GET", headers: {}, url: "/api/admin/unknown", query: {} }, unauthorized);
    assert.equal(unauthorized.statusCode, 401);

    const authorized = createMockNodeResponse();
    await handler(
      {
        method: "GET",
        headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) },
        url: "/api/admin/unknown?range=all",
        query: { range: "all" }
      },
      authorized
    );
    assert.equal(authorized.statusCode, 404);
    assert.equal(authorized.jsonBody.error, "admin_route_not_found");
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
