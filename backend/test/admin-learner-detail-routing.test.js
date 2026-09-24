// Regression coverage for a live-preview 404 on GET /api/admin/learners/:id
// (clicking "View" in the dashboard) while GET /api/admin/learners (the
// list) worked. Investigation (see the project report) found the dispatch
// logic in api/admin/[...path].js already correctly derives ["learners",
// "<uuid>"] from every realistic req.url/req.query shape tested here -- but
// hardened requestedAdminPath()/adminPathFromUrl() to cross-check both
// signals against this router's own known route shapes (isRecognizedAdminPath)
// rather than trusting whichever of req.url/req.query.path happens to be
// non-null first, closing a real gap for a req.url that already arrives
// relative to this function's own /api/admin (or /admin) mount point.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { adminPathFromUrl, requestedAdminPath, isRecognizedAdminPath } from "../api/admin/[...path].js";
import { mintSessionToken } from "../lib/session-token.js";
import { createMockNodeResponse, withEnv } from "./cookie-test-utils.js";

const ADMIN_USERNAME = "staff";
const ADMIN_PASSWORD = "correct-horse-battery-staple";
const SESSION_SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";
const LEARNER_UUID = "6c549230-2fbb-4fa8-80f2-e25cba84b316";

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

// ---------------- 1 & 2: dispatches the learner-detail handler, with the UUID passed intact ----------------

test("requestedAdminPath: a direct /api/admin/learners/:uuid URL resolves to the exact, untruncated two-segment path", () => {
  const segments = requestedAdminPath({ url: `/api/admin/learners/${LEARNER_UUID}`, query: {} });
  assert.deepEqual(segments, ["learners", LEARNER_UUID]);
});

test("GET /api/admin/learners/:uuid reaches the learner-detail route handler (not the list, not a 404), and the UUID is forwarded intact", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: `/api/admin/learners/${LEARNER_UUID}` });
    const res = createMockNodeResponse();
    await handler(req, res);

    // Proves dispatch reached routes/admin/learners/[id].js specifically:
    // this exact error code only comes from that route's own catch block
    // (reached past its `invalid_learner_id` guard, i.e. with a valid,
    // non-empty id) failing at the "Supabase not configured" boundary --
    // never routes/admin/learners.js's admin_learners_failed, and never
    // this dispatcher's own admin_route_not_found.
    assert.equal(res.statusCode, 500);
    assert.equal(res.jsonBody?.error, "admin_learner_detail_failed");
  });
});

test("GET /api/admin/learners/:uuid via req.url alone (Vercel not populating query.path) still resolves the exact UUID, not a truncated or malformed one", () => {
  const segments = requestedAdminPath({ url: `/api/admin/learners/${LEARNER_UUID}`, query: {} });
  assert.equal(segments.length, 2);
  assert.equal(segments[1], LEARNER_UUID);
  assert.equal(segments[1].length, LEARNER_UUID.length);
});

test("GET /api/admin/learners/:uuid via req.query.path alone (no usable req.url) still resolves the exact UUID", () => {
  const segments = requestedAdminPath({ url: undefined, query: { path: ["learners", LEARNER_UUID] } });
  assert.deepEqual(segments, ["learners", LEARNER_UUID]);
});

test("GET /api/admin/learners/:uuid via a req.url already relative to the /api/admin mount point (neither /api nor /admin prefix) still resolves correctly", () => {
  // This is the shape the hardening in adminPathFromUrl specifically added
  // support for: a pathname of just "/learners/<uuid>".
  const segments = requestedAdminPath({ url: `/learners/${LEARNER_UUID}`, query: {} });
  assert.deepEqual(segments, ["learners", LEARNER_UUID]);
});

// ---------------- 3: the list route is unaffected ----------------

test("GET /api/admin/learners (no id) still dispatches the list handler, not learner-detail", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: "/api/admin/learners" });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.jsonBody?.error, "admin_learners_failed");
  });
});

test("requestedAdminPath: /api/admin/learners resolves to a one-segment path, never picking up a stray id", () => {
  assert.deepEqual(requestedAdminPath({ url: "/api/admin/learners", query: {} }), ["learners"]);
});

// ---------------- 4: query strings never affect routing ----------------

test("a query string on the learner-detail URL does not change routing", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: `/api/admin/learners/${LEARNER_UUID}?foo=bar&debug=1` });
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.jsonBody?.error, "admin_learner_detail_failed");
  });
});

test("requestedAdminPath strips the query string before segmenting the path", () => {
  const segments = requestedAdminPath({ url: `/api/admin/learners/${LEARNER_UUID}?range=all`, query: { range: "all" } });
  assert.deepEqual(segments, ["learners", LEARNER_UUID]);
});

test("a conflicting/stale req.query.path never overrides a req.url that already resolves to a known, correctly-shaped route", () => {
  // Same principle as the existing "request URL is authoritative" test,
  // specifically for the two-segment learner-detail shape.
  const segments = requestedAdminPath({
    url: `/api/admin/learners/${LEARNER_UUID}`,
    query: { path: ["dashboard"] }
  });
  assert.deepEqual(segments, ["learners", LEARNER_UUID]);
});

// ---------------- 5: unknown nested routes still 404 ----------------

test("an unknown nested route under /api/admin still authenticates and then returns a scoped 404", async () => {
  await withAdminEnv(async () => {
    const unauthorized = createMockNodeResponse();
    await handler({ method: "GET", headers: {}, url: "/api/admin/learners/not-a-real-sub-route/extra", query: {} }, unauthorized);
    assert.equal(unauthorized.statusCode, 401);

    const authorized = createMockNodeResponse();
    await handler(authedReq({ url: "/api/admin/learners/not-a-real-sub-route/extra" }), authorized);
    assert.equal(authorized.statusCode, 404);
    assert.equal(authorized.jsonBody.error, "admin_route_not_found");
  });
});

test("isRecognizedAdminPath rejects shapes this router does not dispatch, including a 3+ segment learners path", () => {
  assert.equal(isRecognizedAdminPath(["learners", LEARNER_UUID, "extra"]), false);
  assert.equal(isRecognizedAdminPath(["not-a-route"]), false);
  assert.equal(isRecognizedAdminPath(["learners", LEARNER_UUID]), true);
});

test("a genuinely unrelated mount-relative-looking path is never misread as an admin route", () => {
  // Guards the new adminPathFromUrl fallback branch: it must only accept a
  // prefix-less path when the first segment is one of THIS router's own
  // known routes, never an arbitrary unrelated path.
  assert.equal(adminPathFromUrl("/totally/unrelated/path"), null);
});

// ---------------- 6: Basic Auth still applies ----------------

test("GET /api/admin/learners/:uuid rejects a request with no admin credentials", async () => {
  await withAdminEnv(async () => {
    const res = createMockNodeResponse();
    await handler({ method: "GET", headers: {}, url: `/api/admin/learners/${LEARNER_UUID}`, query: {} }, res);
    assert.equal(res.statusCode, 401);
  });
});

test("GET /api/admin/learners/:uuid rejects a customer Learning Progress bearer JWT -- it grants no admin access", async () => {
  await withAdminEnv(async () => {
    const req = { method: "GET", headers: { authorization: customerBearerHeader() }, url: `/api/admin/learners/${LEARNER_UUID}`, query: {} };
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  });
});

test("GET /api/admin/learners/:uuid rejects wrong admin credentials", async () => {
  await withAdminEnv(async () => {
    const req = {
      method: "GET",
      headers: { authorization: basicAuthHeader(ADMIN_USERNAME, "wrong-password") },
      url: `/api/admin/learners/${LEARNER_UUID}`,
      query: {}
    };
    const res = createMockNodeResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  });
});

test("GET /api/admin/learners/:uuid: no Shopify/service-role/session-secret value ever appears in a response body", async () => {
  await withAdminEnv(async () => {
    const req = authedReq({ url: `/api/admin/learners/${LEARNER_UUID}` });
    const res = createMockNodeResponse();
    await handler(req, res);
    const serialized = JSON.stringify(res.jsonBody);
    assert.ok(!serialized.includes(ADMIN_PASSWORD));
    assert.ok(!serialized.includes(SESSION_SECRET));
  });
});

// ---------------- 7: Vercel function count ----------------
// Covered by the existing test/vercel-function-routing.test.js assertion
// (functions.length === 12) -- this change only adds named exports to the
// existing api/admin/[...path].js file, no new file under backend/api/.
