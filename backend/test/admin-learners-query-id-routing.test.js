// Regression coverage for switching learner detail from a nested
// /api/admin/learners/<uuid> URL to /api/admin/learners?id=<uuid>. Live
// Vercel function invocation logs proved the nested URL never reached
// api/admin/[...path].js at all (no path-parsing bug to fix -- see the
// project report); this instead routes learner detail through the exact
// same, already-proven-working /api/admin/learners URL Vercel already
// dispatches correctly, using Vercel's own native query-string parsing
// (req.query.id) instead of any custom nested-path segment logic.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../api/admin/[...path].js";
import { createLearnerDetailHandler } from "../routes/admin/learners/[id].js";
import { createFakeSupabase } from "./fake-supabase.js";
import { mintSessionToken } from "../lib/session-token.js";
import { createMockNodeResponse, withEnv } from "./cookie-test-utils.js";

const ADMIN_USERNAME = "staff";
const ADMIN_PASSWORD = "correct-horse-battery-staple";
const SESSION_SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";
const LEARNER_UUID = "6c549230-2fbb-4fa8-80f2-e25cba84b316";
const OTHER_UUID = "9a111111-2222-4333-8444-555566667777";
const UNKNOWN_UUID = "00000000-0000-0000-0000-000000000000";

const BACKEND_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function authedReq(overrides) {
  return { method: "GET", headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) }, query: {}, ...overrides };
}

// ---------------- 1: /api/admin/learners (no id) -> list ----------------

test("GET /api/admin/learners with no id query param dispatches the list handler", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: "/api/admin/learners", query: {} });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.jsonBody?.error, "admin_learners_failed");
  });
});

test("GET /api/admin/learners?id= (present but empty) is treated as missing -- dispatches the list handler, not detail", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: "/api/admin/learners?id=", query: { id: "" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.jsonBody?.error, "admin_learners_failed");
  });
});

// ---------------- 2 & 3: /api/admin/learners?id=<uuid> -> detail, UUID intact ----------------

test("GET /api/admin/learners?id=<uuid> dispatches the learner-detail handler, not the list", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: `/api/admin/learners?id=${LEARNER_UUID}`, query: { id: LEARNER_UUID } });
    const res = createMockNodeResponse();
    await handler(req, res);
    // admin_learner_detail_failed only comes from routes/admin/learners/[id].js's
    // own catch block, reached past its own id-format validation -- proves
    // dispatch, not routes/admin/learners.js (admin_learners_failed) and not
    // this dispatcher's own admin_route_not_found.
    assert.equal(res.statusCode, 500);
    assert.equal(res.jsonBody?.error, "admin_learner_detail_failed");
  });
});

test("for a plain string ?id=, the dispatcher's routing decision changes nothing observable vs calling the detail handler directly (id read via req.query, not custom path-segment parsing)", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: `/api/admin/learners?id=${LEARNER_UUID}`, query: { id: LEARNER_UUID } });
    const viaDispatcher = createMockNodeResponse();
    await handler(req, viaDispatcher);

    const viaHandlerDirectly = createMockNodeResponse();
    const { default: learnerDetailHandler } = await import("../routes/admin/learners/[id].js");
    await learnerDetailHandler(req, viaHandlerDirectly);

    assert.equal(viaDispatcher.statusCode, viaHandlerDirectly.statusCode);
    assert.deepEqual(viaDispatcher.jsonBody, viaHandlerDirectly.jsonBody);
  });
});

test("the exact UUID reaches the detail handler intact and resolves only the matching learner (fake Supabase, no dispatcher involved)", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await supabase
      .from("learning_users")
      .insert({ id: LEARNER_UUID, shopify_customer_id: "111111", created_at: "2026-01-01T00:00:00Z", last_seen_at: "2026-01-01T00:00:00Z" });
    await supabase
      .from("learning_users")
      .insert({ id: OTHER_UUID, shopify_customer_id: "222222", created_at: "2026-01-01T00:00:00Z", last_seen_at: "2026-01-01T00:00:00Z" });

    const detailHandler = createLearnerDetailHandler({ getClient: async () => supabase });
    const req = authedReq({ query: { id: LEARNER_UUID } });
    const res = createMockNodeResponse();
    await detailHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonBody.learning_user_id, LEARNER_UUID);
    assert.equal(res.jsonBody.shopify_customer_id, "111111", "must resolve the requested learner, not the other seeded one");
  });
});

// ---------------- 4: malformed id -> 400, not 500 ----------------

test("GET /api/admin/learners?id=<malformed> returns 400, never 500", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: "/api/admin/learners?id=not-a-uuid", query: { id: "not-a-uuid" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonBody?.error, "invalid_learner_id");
  });
});

test("createLearnerDetailHandler never reaches the database for a malformed id", async () => {
  await withAdminEnv(async () => {
    let dbCalled = false;
    const detailHandler = createLearnerDetailHandler({ getClient: async () => { dbCalled = true; return createFakeSupabase(); } });
    const res = createMockNodeResponse();
    await detailHandler(authedReq({ query: { id: "'; drop table learning_users; --" } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(dbCalled, false);
  });
});

// ---------------- 5: unknown valid learner -> 404 ----------------

test("GET /api/admin/learners?id=<well-formed-but-unknown-uuid> returns 404 learner_not_found, from the real database lookup logic", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await supabase
      .from("learning_users")
      .insert({ id: LEARNER_UUID, shopify_customer_id: "111111", created_at: "2026-01-01T00:00:00Z", last_seen_at: "2026-01-01T00:00:00Z" });

    const detailHandler = createLearnerDetailHandler({ getClient: async () => supabase });
    const res = createMockNodeResponse();
    await detailHandler(authedReq({ query: { id: UNKNOWN_UUID } }), res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.jsonBody?.error, "learner_not_found");
  });
});

// ---------------- 6: other query params never break list routing ----------------

test("unrelated query params on /api/admin/learners never redirect it into detail mode", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: "/api/admin/learners?range=all&sort=desc", query: { range: "all", sort: "desc" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.jsonBody?.error, "admin_learners_failed");
  });
});

test("unrelated query params alongside a real id do not interfere with detail routing", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: `/api/admin/learners?id=${LEARNER_UUID}&debug=1`, query: { id: LEARNER_UUID, debug: "1" } });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.jsonBody?.error, "admin_learner_detail_failed");
  });
});

test("a repeated ?id=a&id=b query param (arrives as an array) uses the first value rather than silently falling back to the list", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: "/api/admin/learners", query: { id: [LEARNER_UUID, OTHER_UUID] } });
    const res = createMockNodeResponse();
    await handler(req, res);
    // Reaches detail (not the list's admin_learners_failed) -- proves the
    // array value was recognized as "an id is present", not ignored.
    assert.equal(res.jsonBody?.error, "admin_learner_detail_failed");
  });
});

// ---------------- 7: Basic Auth protects both modes ----------------

test("GET /api/admin/learners (list mode) rejects a request with no admin credentials", async () => {
  await withAdminEnv(async () => {
    const res = createMockNodeResponse();
    await handler({ method: "GET", headers: {}, url: "/api/admin/learners", query: {} }, res);
    assert.equal(res.statusCode, 401);
  });
});

test("GET /api/admin/learners?id=<uuid> (detail mode) rejects a request with no admin credentials", async () => {
  await withAdminEnv(async () => {
    const res = createMockNodeResponse();
    await handler({ method: "GET", headers: {}, url: `/api/admin/learners?id=${LEARNER_UUID}`, query: { id: LEARNER_UUID } }, res);
    assert.equal(res.statusCode, 401);
  });
});

test("GET /api/admin/learners?id=<uuid> rejects a customer Learning Progress bearer JWT -- it grants no admin access", async () => {
  await withAdminEnv(async () => {
    const req = {
      method: "GET",
      headers: { authorization: customerBearerHeader() },
      url: `/api/admin/learners?id=${LEARNER_UUID}`,
      query: { id: LEARNER_UUID }
    };
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  });
});

test("GET /api/admin/learners?id=<uuid> rejects wrong admin credentials", async () => {
  await withAdminEnv(async () => {
    const req = {
      method: "GET",
      headers: { authorization: basicAuthHeader(ADMIN_USERNAME, "wrong-password") },
      url: `/api/admin/learners?id=${LEARNER_UUID}`,
      query: { id: LEARNER_UUID }
    };
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  });
});

test("no secret (admin password, session secret) ever appears in a detail-mode response body", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: `/api/admin/learners?id=${LEARNER_UUID}`, query: { id: LEARNER_UUID } });
    const res = createMockNodeResponse();
    await handler(req, res);
    const serialized = JSON.stringify(res.jsonBody);
    assert.ok(!serialized.includes(ADMIN_PASSWORD));
    assert.ok(!serialized.includes(SESSION_SECRET));
  });
});

// ---------------- 8: frontend uses the query-string detail URL ----------------

test("the dashboard frontend fetches learner detail via ?id=, not a nested path", () => {
  const source = fs.readFileSync(path.join(BACKEND_DIR, "routes/admin/index.js"), "utf8");
  assert.ok(
    source.includes("fetchJson('/api/admin/learners?id=' + encodeURIComponent(id))"),
    "openLearnerDetail must fetch the query-string form"
  );
  assert.ok(
    !source.includes("fetchJson('/api/admin/learners/' + encodeURIComponent(id))"),
    "the old nested-path fetch call must no longer be present"
  );
});

// ---------------- 9: Vercel function count stays at 12 ----------------

test("Vercel function count remains 12 -- this change added no new file under backend/api/", () => {
  function findJavaScriptFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findJavaScriptFiles(absolutePath);
      return entry.isFile() && entry.name.endsWith(".js") ? [absolutePath] : [];
    });
  }
  const functions = findJavaScriptFiles(path.join(BACKEND_DIR, "api"));
  assert.equal(functions.length, 12);
});
