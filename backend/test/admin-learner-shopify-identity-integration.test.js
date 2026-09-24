// Regression coverage for the confirmed learner-name mapping bug: Shopify
// Admin identity resolution was proven working end to end (see the project
// report's identity-diagnostics run), yet the learners list/detail routes
// still showed "Customer #<id>". Root cause: learning_users.shopify_customer_id
// is a Postgres `bigint` column, and PostgREST/supabase-js returns bigint
// columns as a JSON NUMBER, not a string. lib/analytics-service.js's
// computeLearnerTable/computeLearnerDetail passed that raw number straight
// through; lib/learner-identity.js's resolveShopifyIdentities then silently
// DROPPED it (`typeof id === "string"` filter), so the Shopify lookup was
// never even attempted -- no error, just an empty result, which is exactly
// why nothing useful appeared in logs before this fix's added diagnostics.
//
// Every existing fixture in this codebase constructed shopify_customer_id
// as a string literal, which is why none of them caught this. These tests
// specifically insert it as a JS number (matching real Postgres/PostgREST
// behavior) to prove the fix, using the exact ids from the live incident.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLearnersListHandler } from "../routes/admin/learners.js";
import { createLearnerDetailHandler } from "../routes/admin/learners/[id].js";
import { createFakeSupabase } from "./fake-supabase.js";
import { mintSessionToken } from "../lib/session-token.js";
import { createMockNodeResponse, withEnv, withCapturedConsoleError } from "./cookie-test-utils.js";

const ADMIN_USERNAME = "staff";
const ADMIN_PASSWORD = "correct-horse-battery-staple";
const SESSION_SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";

const LEARNER_UUID = "6c549230-2fbb-4fa8-80f2-e25cba84b316";
const CUSTOMER_ID_NUMBER = 7662557626701; // exactly as Postgres bigint -> PostgREST JSON -> JS number arrives
const CUSTOMER_ID_STRING = "7662557626701";
const CUSTOMER_NAME = "James Lee";
const CUSTOMER_EMAIL = "james.lee047@example.com";
const SECRET_TOKEN = "shpat_super_secret_admin_token_value";

const CONFIG = {
  configured: true,
  authMode: "client_credentials",
  shopDomain: SHOP,
  clientId: "client-id",
  clientSecret: "client-secret",
  apiVersion: "2026-07"
};

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

function seedLearner(supabase, { id = LEARNER_UUID, shopifyCustomerId = CUSTOMER_ID_NUMBER } = {}) {
  return supabase.from("learning_users").insert({
    id,
    shopify_customer_id: shopifyCustomerId,
    created_at: "2026-01-01T00:00:00Z",
    last_seen_at: "2026-01-01T00:00:00Z"
  });
}

// Fakes the token + customers(nodes) endpoints; captures the exact GID(s)
// requested so tests can assert the numeric id survived unmutated.
function fakeShopifyFetch(customerFields) {
  const requestedIds = [];
  const fetchImpl = async (url, options) => {
    if (url.includes("/admin/oauth/access_token")) {
      return { ok: true, json: async () => ({ access_token: SECRET_TOKEN, expires_in: 3600 }) };
    }
    const body = JSON.parse(options.body);
    const ids = body.variables.ids;
    requestedIds.push(...ids);
    if (customerFields === null) {
      return { ok: true, json: async () => ({ data: { nodes: [null] } }) };
    }
    return {
      ok: true,
      json: async () => ({ data: { nodes: ids.map((gid) => ({ id: gid, displayName: customerFields.displayName, email: customerFields.email })) } } )
    };
  };
  return { fetchImpl, requestedIds };
}

function assertNoSecretsLeaked(logs) {
  const serialized = logs.join("\n");
  assert.ok(!serialized.includes(SECRET_TOKEN));
  assert.ok(!serialized.includes(CUSTOMER_NAME));
  assert.ok(!serialized.includes(CUSTOMER_EMAIL));
}

// ---------------- LIST route ----------------

test("LIST: a successful Shopify identity is used -- display_name is present, not the fallback", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl } = fakeShopifyFetch({ displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL });

    const listHandler = createLearnersListHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    const res = createMockNodeResponse();
    await listHandler(authedReq(), res);

    assert.equal(res.statusCode, 200);
    const learner = res.jsonBody.learners.find((l) => l.shopify_customer_id === CUSTOMER_ID_STRING);
    assert.ok(learner, "the seeded learner must be present, keyed by the exact string id");
    assert.equal(learner.display_name, CUSTOMER_NAME);
  });
});

test("LIST: the Shopify customer id survives the full round trip as the exact string, never mutated", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl, requestedIds } = fakeShopifyFetch({ displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL });

    const listHandler = createLearnersListHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    const res = createMockNodeResponse();
    await listHandler(authedReq(), res);

    assert.deepEqual(requestedIds, [`gid://shopify/Customer/${CUSTOMER_ID_STRING}`], "exact GID, no precision loss/mutation");
    const learner = res.jsonBody.learners[0];
    assert.equal(learner.shopify_customer_id, CUSTOMER_ID_STRING);
    assert.equal(typeof learner.shopify_customer_id, "string");
  });
});

test("LIST: fallback_label is used only when the lookup genuinely fails, not on a successful resolution", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl } = fakeShopifyFetch({ displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL });

    const listHandler = createLearnersListHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    const res = createMockNodeResponse();
    await listHandler(authedReq(), res);

    const learner = res.jsonBody.learners[0];
    assert.equal(learner.display_name, CUSTOMER_NAME);
    assert.equal(learner.fallback_label, `Customer #${CUSTOMER_ID_STRING}`, "fallback_label always exists but must not be what the UI uses when a name is present");
  });
});

test("LIST: a genuine lookup failure (Shopify unreachable) correctly falls back to the customer id, not a crash", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const fetchImpl = async () => { throw new Error("simulated network failure"); };

    const listHandler = createLearnersListHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    const res = createMockNodeResponse();
    await listHandler(authedReq(), res);

    assert.equal(res.statusCode, 200);
    const learner = res.jsonBody.learners[0];
    assert.equal(learner.display_name, null);
    assert.equal(learner.shopify_customer_id, CUSTOMER_ID_STRING, "the id itself must still be correct even when the name lookup fails");
  });
});

test("LIST: a partial identity (name only, email redacted) still shows the name", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl } = fakeShopifyFetch({ displayName: CUSTOMER_NAME, email: null });

    const listHandler = createLearnersListHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    const res = createMockNodeResponse();
    await listHandler(authedReq(), res);

    assert.equal(res.jsonBody.learners[0].display_name, CUSTOMER_NAME);
  });
});

test("LIST: requires admin credentials", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    const listHandler = createLearnersListHandler({ getClient: async () => supabase });
    const res = createMockNodeResponse();
    await listHandler({ method: "GET", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 401);
  });
});

test("LIST: rejects a customer Learning Progress bearer JWT", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    const listHandler = createLearnersListHandler({ getClient: async () => supabase });
    const res = createMockNodeResponse();
    await listHandler({ method: "GET", headers: { authorization: customerBearerHeader() }, query: {} }, res);
    assert.equal(res.statusCode, 401);
  });
});

test("LIST: no PII is written back to the learning_users table after a successful resolution", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl } = fakeShopifyFetch({ displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL });

    const listHandler = createLearnersListHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    await listHandler(authedReq(), createMockNodeResponse());

    const rows = supabase.tables.learning_users;
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]).sort(), ["created_at", "id", "last_seen_at", "shopify_customer_id"]);
  });
});

test("LIST: no secret or PII appears in logs during a successful resolution", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl } = fakeShopifyFetch({ displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL });
    const listHandler = createLearnersListHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });

    const { logs } = await withCapturedConsoleError(() => listHandler(authedReq(), createMockNodeResponse()));
    assertNoSecretsLeaked(logs);
  });
});

// ---------------- DETAIL route ----------------

test("DETAIL: a successful Shopify identity is used -- display_name and email are both present", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl } = fakeShopifyFetch({ displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL });

    const detailHandler = createLearnerDetailHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    const res = createMockNodeResponse();
    await detailHandler(authedReq({ query: { id: LEARNER_UUID } }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonBody.display_name, CUSTOMER_NAME);
    assert.equal(res.jsonBody.email, CUSTOMER_EMAIL);
  });
});

test("DETAIL: the Shopify customer id survives the full round trip as the exact string, never mutated", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl, requestedIds } = fakeShopifyFetch({ displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL });

    const detailHandler = createLearnerDetailHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    const res = createMockNodeResponse();
    await detailHandler(authedReq({ query: { id: LEARNER_UUID } }), res);

    assert.deepEqual(requestedIds, [`gid://shopify/Customer/${CUSTOMER_ID_STRING}`]);
    assert.equal(res.jsonBody.shopify_customer_id, CUSTOMER_ID_STRING);
    assert.equal(typeof res.jsonBody.shopify_customer_id, "string");
  });
});

test("DETAIL: fallback only happens when the lookup genuinely fails", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const fetchImpl = async () => { throw new Error("simulated network failure"); };

    const detailHandler = createLearnerDetailHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    const res = createMockNodeResponse();
    await detailHandler(authedReq({ query: { id: LEARNER_UUID } }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonBody.display_name, null);
    assert.equal(res.jsonBody.fallback_label, `Customer #${CUSTOMER_ID_STRING}`);
  });
});

test("DETAIL: a partial identity (name only, email redacted) still shows the name", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl } = fakeShopifyFetch({ displayName: CUSTOMER_NAME, email: null });

    const detailHandler = createLearnerDetailHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    const res = createMockNodeResponse();
    await detailHandler(authedReq({ query: { id: LEARNER_UUID } }), res);

    assert.equal(res.jsonBody.display_name, CUSTOMER_NAME);
    assert.equal(res.jsonBody.email, null);
  });
});

test("DETAIL: requires admin credentials", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const detailHandler = createLearnerDetailHandler({ getClient: async () => supabase });
    const res = createMockNodeResponse();
    await detailHandler({ method: "GET", headers: {}, query: { id: LEARNER_UUID } }, res);
    assert.equal(res.statusCode, 401);
  });
});

test("DETAIL: rejects a customer Learning Progress bearer JWT", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const detailHandler = createLearnerDetailHandler({ getClient: async () => supabase });
    const res = createMockNodeResponse();
    await detailHandler({ method: "GET", headers: { authorization: customerBearerHeader() }, query: { id: LEARNER_UUID } }, res);
    assert.equal(res.statusCode, 401);
  });
});

test("DETAIL: no PII is written back to the learning_users table after a successful resolution", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl } = fakeShopifyFetch({ displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL });

    const detailHandler = createLearnerDetailHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    await detailHandler(authedReq({ query: { id: LEARNER_UUID } }), createMockNodeResponse());

    const rows = supabase.tables.learning_users;
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]).sort(), ["created_at", "id", "last_seen_at", "shopify_customer_id"]);
  });
});

test("DETAIL: no secret or PII appears in logs during a successful resolution", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl } = fakeShopifyFetch({ displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL });
    const detailHandler = createLearnerDetailHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });

    const { logs } = await withCapturedConsoleError(() => detailHandler(authedReq({ query: { id: LEARNER_UUID } }), createMockNodeResponse()));
    assertNoSecretsLeaked(logs);
  });
});

test("DETAIL: a null customer node (not found/denied) falls back cleanly, not a crash", async () => {
  await withAdminEnv(async () => {
    const supabase = createFakeSupabase();
    await seedLearner(supabase);
    const { fetchImpl } = fakeShopifyFetch(null);

    const detailHandler = createLearnerDetailHandler({ getClient: async () => supabase, getConfig: () => CONFIG, fetchImpl });
    const res = createMockNodeResponse();
    await detailHandler(authedReq({ query: { id: LEARNER_UUID } }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonBody.display_name, null);
  });
});
