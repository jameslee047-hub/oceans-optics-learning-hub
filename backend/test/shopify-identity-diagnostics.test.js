// Diagnostics coverage for lib/shopify-admin-client.js's logging,
// lib/shopify-identity-diagnostics.js's orchestration, and
// routes/admin/identity-diagnostics.js's admin-only endpoint. Every test
// that can plausibly produce a log line also asserts the log never
// contains a secret, token, or customer PII -- see the project report's
// explicit "never log" list.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getShopifyAdminAccessToken,
  fetchShopifyCustomersByIds,
  fetchGrantedAdminScopes
} from "../lib/shopify-admin-client.js";
import { diagnoseShopifyIdentity } from "../lib/shopify-identity-diagnostics.js";
import identityDiagnosticsHandler from "../routes/admin/identity-diagnostics.js";
import { mintSessionToken } from "../lib/session-token.js";
import { createMockNodeResponse, withEnv, withCapturedConsoleError } from "./cookie-test-utils.js";

const ADMIN_USERNAME = "staff";
const ADMIN_PASSWORD = "correct-horse-battery-staple";
const SESSION_SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";
const SECRET_TOKEN = "shpat_super_secret_admin_token_value";
const SECRET_CLIENT_SECRET = "top-secret-client-secret-value";
const CUSTOMER_EMAIL = "james.lee047@example.com";
const CUSTOMER_NAME = "James Lee";
const CUSTOMER_ID = "7662557626701"; // the exact id from the live incident

const CLIENT_CREDENTIALS_CONFIG = {
  configured: true,
  authMode: "client_credentials",
  shopDomain: SHOP,
  clientId: "client-id",
  clientSecret: SECRET_CLIENT_SECRET,
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

function assertNoSecretsLeaked(logs) {
  const serialized = logs.join("\n");
  assert.ok(!serialized.includes(SECRET_TOKEN), "access token must never appear in logs");
  assert.ok(!serialized.includes(SECRET_CLIENT_SECRET), "client secret must never appear in logs");
  assert.ok(!serialized.toLowerCase().includes("authorization"), "no Authorization header content should be logged");
  assert.ok(!serialized.includes(CUSTOMER_EMAIL), "customer email must never appear in logs");
  assert.ok(!serialized.includes(CUSTOMER_NAME), "customer name must never appear in logs");
}

// Routes a fake fetch to the token endpoint, the scopes (currentAppInstallation)
// query, or the customers (nodes) query, based on the request shape --
// lets one fake stand in for a whole diagnostics run.
function fakeShopify({ tokenBehavior, scopesBehavior, customersBehavior } = {}) {
  return async (url, options) => {
    if (url.includes("/admin/oauth/access_token")) {
      const behavior = tokenBehavior ? tokenBehavior() : { ok: true, access_token: SECRET_TOKEN };
      if (behavior.networkError) throw new Error("simulated network error");
      if (!behavior.ok) return { ok: false, status: behavior.status || 500, json: async () => ({}) };
      return { ok: true, json: async () => ({ access_token: behavior.access_token, expires_in: 3600 }) };
    }

    const body = JSON.parse(options.body);
    assert.equal(options.headers["X-Shopify-Access-Token"], SECRET_TOKEN, "must authenticate with the minted token");

    if (body.query.includes("currentAppInstallation")) {
      const behavior = scopesBehavior ? scopesBehavior() : { ok: true, scopes: ["read_customers"] };
      if (behavior.networkError) throw new Error("simulated network error");
      if (!behavior.ok) return { ok: false, status: behavior.status || 500, json: async () => ({}) };
      if (behavior.graphqlError) return { ok: true, json: async () => ({ errors: [{ message: "boom" }] }) };
      return {
        ok: true,
        json: async () => ({ data: { currentAppInstallation: { accessScopes: behavior.scopes.map((handle) => ({ handle })) } } })
      };
    }

    // Customer nodes(ids:...) query.
    const behavior = customersBehavior ? customersBehavior(body) : { ok: true, nodes: [] };
    if (behavior.networkError) throw new Error("simulated network error");
    if (!behavior.ok) return { ok: false, status: behavior.status || 500, json: async () => ({}) };
    return { ok: true, json: async () => behavior.responseBody ?? { data: { nodes: behavior.nodes || [] } } };
  };
}

// ============ 1. Token acquisition diagnostics ============

test("token acquisition: success is logged with only auth_mode, never the token", async () => {
  const { result: token, logs } = await withCapturedConsoleError(() =>
    getShopifyAdminAccessToken(CLIENT_CREDENTIALS_CONFIG, { fetchImpl: fakeShopify() })
  );
  assert.equal(token, SECRET_TOKEN);
  assert.ok(logs.some((l) => l.includes("[shopify-identity] admin token acquired") && l.includes("auth_mode=client_credentials")));
  assertNoSecretsLeaked(logs);
});

test("token acquisition: an HTTP failure is logged with http_status and shop_domain, never a response body", async () => {
  const fetchImpl = fakeShopify({ tokenBehavior: () => ({ ok: false, status: 401 }) });
  const { logs } = await withCapturedConsoleError(() =>
    assert.rejects(() => getShopifyAdminAccessToken(CLIENT_CREDENTIALS_CONFIG, { fetchImpl }))
  );
  assert.ok(logs.some((l) => l.includes("token acquisition failed") && l.includes("http_status=401") && l.includes(`shop_domain=${SHOP}`)));
  assertNoSecretsLeaked(logs);
});

test("token acquisition: a network error is categorized as error_type=network_error", async () => {
  const fetchImpl = fakeShopify({ tokenBehavior: () => ({ networkError: true }) });
  const { logs } = await withCapturedConsoleError(() =>
    assert.rejects(() => getShopifyAdminAccessToken(CLIENT_CREDENTIALS_CONFIG, { fetchImpl }))
  );
  assert.ok(logs.some((l) => l.includes("token acquisition failed") && l.includes("error_type=network_error")));
  assertNoSecretsLeaked(logs);
});

test("token acquisition: a missing access_token in the response body is categorized distinctly", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });
  const { logs } = await withCapturedConsoleError(() =>
    assert.rejects(() => getShopifyAdminAccessToken(CLIENT_CREDENTIALS_CONFIG, { fetchImpl }))
  );
  assert.ok(logs.some((l) => l.includes("error_type=missing_access_token")));
});

// ============ 2. Granted-scope check ============

test("fetchGrantedAdminScopes: returns the actual granted scope handles from currentAppInstallation", async () => {
  const fetchImpl = fakeShopify({ scopesBehavior: () => ({ ok: true, scopes: ["write_app_proxy", "read_customers"] }) });
  const scopes = await fetchGrantedAdminScopes({ shopDomain: SHOP, accessToken: SECRET_TOKEN, fetchImpl });
  assert.deepEqual(scopes, ["write_app_proxy", "read_customers"]);
  assert.ok(scopes.includes("read_customers"));
});

test("fetchGrantedAdminScopes: read_customers is correctly reported absent when not granted", async () => {
  const fetchImpl = fakeShopify({ scopesBehavior: () => ({ ok: true, scopes: ["write_app_proxy"] }) });
  const scopes = await fetchGrantedAdminScopes({ shopDomain: SHOP, accessToken: SECRET_TOKEN, fetchImpl });
  assert.ok(!scopes.includes("read_customers"));
});

test("fetchGrantedAdminScopes: an HTTP or GraphQL failure throws and logs a safe reason only", async () => {
  const fetchImpl = fakeShopify({ scopesBehavior: () => ({ ok: false, status: 403 }) });
  const { logs } = await withCapturedConsoleError(() =>
    assert.rejects(() => fetchGrantedAdminScopes({ shopDomain: SHOP, accessToken: SECRET_TOKEN, fetchImpl }))
  );
  assert.ok(logs.some((l) => l.includes("scope check failed") && l.includes("http_status=403")));
  assertNoSecretsLeaked(logs);
});

// ============ 3. Customer GraphQL diagnostics ============

test("customer lookup: a successful resolution is logged with only a count", async () => {
  const fetchImpl = fakeShopify({
    customersBehavior: () => ({ ok: true, nodes: [{ id: `gid://shopify/Customer/${CUSTOMER_ID}`, displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL }] })
  });
  const { result: resolved, logs } = await withCapturedConsoleError(() =>
    fetchShopifyCustomersByIds({ shopDomain: SHOP, accessToken: SECRET_TOKEN, numericCustomerIds: [CUSTOMER_ID], fetchImpl })
  );
  assert.deepEqual(resolved.get(CUSTOMER_ID), { displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL });
  assert.ok(logs.some((l) => l.includes("customer identity resolved successfully") && l.includes("count=1")));
  assertNoSecretsLeaked(logs);
});

test("customer lookup: an HTTP auth failure (401/403) is categorized as http_auth_failed, distinct from other HTTP errors", async () => {
  const fetchImpl = fakeShopify({ customersBehavior: () => ({ ok: false, status: 403 }) });
  const { logs } = await withCapturedConsoleError(() =>
    assert.rejects(() => fetchShopifyCustomersByIds({ shopDomain: SHOP, accessToken: SECRET_TOKEN, numericCustomerIds: [CUSTOMER_ID], fetchImpl }))
  );
  assert.ok(logs.some((l) => l.includes("reason=http_auth_failed") && l.includes("http_status=403")));
});

test("customer lookup: a 429 is categorized as rate_limited", async () => {
  const fetchImpl = fakeShopify({ customersBehavior: () => ({ ok: false, status: 429 }) });
  const { logs } = await withCapturedConsoleError(() =>
    assert.rejects(() => fetchShopifyCustomersByIds({ shopDomain: SHOP, accessToken: SECRET_TOKEN, numericCustomerIds: [CUSTOMER_ID], fetchImpl }))
  );
  assert.ok(logs.some((l) => l.includes("reason=rate_limited") && l.includes("http_status=429")));
});

test("customer lookup: a network error is categorized as network_error", async () => {
  const fetchImpl = fakeShopify({ customersBehavior: () => ({ networkError: true }) });
  const { logs } = await withCapturedConsoleError(() =>
    assert.rejects(() => fetchShopifyCustomersByIds({ shopDomain: SHOP, accessToken: SECRET_TOKEN, numericCustomerIds: [CUSTOMER_ID], fetchImpl }))
  );
  assert.ok(logs.some((l) => l.includes("reason=network_error")));
});

test("customer lookup: a top-level ACCESS_DENIED GraphQL error is categorized as access_denied and the batch fails (matches missing read_customers)", async () => {
  const fetchImpl = fakeShopify({
    customersBehavior: () => ({
      ok: true,
      responseBody: {
        errors: [{ message: "Access denied for customers field. Required access: `read_customers`.", extensions: { code: "ACCESS_DENIED" } }]
      }
    })
  });
  const { result, logs } = await withCapturedConsoleError(async () => {
    let thrown = null;
    try {
      await fetchShopifyCustomersByIds({ shopDomain: SHOP, accessToken: SECRET_TOKEN, numericCustomerIds: [CUSTOMER_ID], fetchImpl });
    } catch (error) {
      thrown = error;
    }
    return thrown;
  });
  assert.ok(result, "must throw");
  assert.ok(logs.some((l) => l.includes("customer lookup failed") && l.includes("reason=access_denied")));
  assertNoSecretsLeaked(logs);
});

test("customer lookup: a top-level THROTTLED GraphQL error is categorized as throttled", async () => {
  const fetchImpl = fakeShopify({
    customersBehavior: () => ({ ok: true, responseBody: { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] } })
  });
  const { logs } = await withCapturedConsoleError(() =>
    assert.rejects(() => fetchShopifyCustomersByIds({ shopDomain: SHOP, accessToken: SECRET_TOKEN, numericCustomerIds: [CUSTOMER_ID], fetchImpl }))
  );
  assert.ok(logs.some((l) => l.includes("reason=throttled")));
});

test("customer lookup: an unrecognized top-level GraphQL error is categorized as graphql_error", async () => {
  const fetchImpl = fakeShopify({
    customersBehavior: () => ({ ok: true, responseBody: { errors: [{ message: "Internal error", extensions: { code: "INTERNAL_SERVER_ERROR" } }] } })
  });
  const { logs } = await withCapturedConsoleError(() =>
    assert.rejects(() => fetchShopifyCustomersByIds({ shopDomain: SHOP, accessToken: SECRET_TOKEN, numericCustomerIds: [CUSTOMER_ID], fetchImpl }))
  );
  assert.ok(logs.some((l) => l.includes("reason=graphql_error")));
});

test("customer lookup: a field-level protected-data error (has a path) does NOT discard the batch -- partial data is still used", async () => {
  const fetchImpl = fakeShopify({
    customersBehavior: () => ({
      ok: true,
      responseBody: {
        data: { nodes: [{ id: `gid://shopify/Customer/${CUSTOMER_ID}`, displayName: CUSTOMER_NAME, email: null }] },
        errors: [{ message: "field unavailable", path: ["nodes", 0, "email"], extensions: { code: "ACCESS_DENIED" } }]
      }
    })
  });
  const { result: resolved, logs } = await withCapturedConsoleError(() =>
    fetchShopifyCustomersByIds({ shopDomain: SHOP, accessToken: SECRET_TOKEN, numericCustomerIds: [CUSTOMER_ID], fetchImpl })
  );
  assert.deepEqual(resolved.get(CUSTOMER_ID), { displayName: CUSTOMER_NAME, email: null }, "displayName must still be usable even with email redacted");
  assert.ok(logs.some((l) => l.includes("customer node resolved but protected fields unavailable")));
  assertNoSecretsLeaked(logs);
});

test("customer lookup: a node with both fields empty (no error entry at all) is logged as protected fields unavailable, not a silent success", async () => {
  const fetchImpl = fakeShopify({
    customersBehavior: () => ({ ok: true, nodes: [{ id: `gid://shopify/Customer/${CUSTOMER_ID}`, displayName: null, email: null }] })
  });
  const { result: resolved, logs } = await withCapturedConsoleError(() =>
    fetchShopifyCustomersByIds({ shopDomain: SHOP, accessToken: SECRET_TOKEN, numericCustomerIds: [CUSTOMER_ID], fetchImpl })
  );
  assert.deepEqual(resolved.get(CUSTOMER_ID), { displayName: null, email: null });
  assert.ok(logs.some((l) => l.includes("customer node resolved but protected fields unavailable") && l.includes("count=1")));
  assert.ok(!logs.some((l) => l.includes("resolved successfully")));
});

test("customer lookup: a null customer node is logged with a count and left unresolved (not a crash)", async () => {
  const fetchImpl = fakeShopify({ customersBehavior: () => ({ ok: true, nodes: [null] }) });
  const { result: resolved, logs } = await withCapturedConsoleError(() =>
    fetchShopifyCustomersByIds({ shopDomain: SHOP, accessToken: SECRET_TOKEN, numericCustomerIds: [CUSTOMER_ID], fetchImpl })
  );
  assert.equal(resolved.size, 0);
  assert.ok(logs.some((l) => l.includes("customer node returned null") && l.includes("count=1")));
});

// ============ diagnoseShopifyIdentity orchestration ============

test("diagnoseShopifyIdentity: not configured at all", async () => {
  const diagnostics = await diagnoseShopifyIdentity({ getConfig: () => ({ configured: false }) });
  assert.deepEqual(diagnostics, {
    adminApiAuthenticated: false,
    readCustomersGranted: false,
    scopeCheck: "not_configured",
    customerLookup: "not_attempted"
  });
});

test("diagnoseShopifyIdentity: auth fails -- reports adminApiAuthenticated false, never throws", async () => {
  const fetchImpl = fakeShopify({ tokenBehavior: () => ({ ok: false, status: 401 }) });
  const { result: diagnostics, logs } = await withCapturedConsoleError(() =>
    diagnoseShopifyIdentity({ getConfig: () => CLIENT_CREDENTIALS_CONFIG, fetchImpl })
  );
  assert.equal(diagnostics.adminApiAuthenticated, false);
  assert.equal(diagnostics.readCustomersGranted, false);
  assertNoSecretsLeaked(logs);
});

test("diagnoseShopifyIdentity: authenticated, read_customers granted, no sample id requested", async () => {
  const fetchImpl = fakeShopify({ scopesBehavior: () => ({ ok: true, scopes: ["read_customers"] }) });
  const diagnostics = await diagnoseShopifyIdentity({ getConfig: () => CLIENT_CREDENTIALS_CONFIG, fetchImpl });
  assert.deepEqual(diagnostics, {
    adminApiAuthenticated: true,
    readCustomersGranted: true,
    scopeCheck: "ok",
    customerLookup: "not_attempted"
  });
});

test("diagnoseShopifyIdentity: authenticated, read_customers NOT granted (the current live state)", async () => {
  const fetchImpl = fakeShopify({ scopesBehavior: () => ({ ok: true, scopes: ["write_app_proxy"] }) });
  const diagnostics = await diagnoseShopifyIdentity({ getConfig: () => CLIENT_CREDENTIALS_CONFIG, fetchImpl });
  assert.equal(diagnostics.adminApiAuthenticated, true);
  assert.equal(diagnostics.readCustomersGranted, false);
});

test("diagnoseShopifyIdentity: scope check itself fails -- surfaced distinctly, never thrown", async () => {
  const fetchImpl = fakeShopify({ scopesBehavior: () => ({ ok: false, status: 500 }) });
  const diagnostics = await diagnoseShopifyIdentity({ getConfig: () => CLIENT_CREDENTIALS_CONFIG, fetchImpl });
  assert.equal(diagnostics.adminApiAuthenticated, true);
  assert.equal(diagnostics.scopeCheck, "failed");
});

test("diagnoseShopifyIdentity: a sample customerId resolves fully (displayName + email)", async () => {
  const fetchImpl = fakeShopify({
    scopesBehavior: () => ({ ok: true, scopes: ["read_customers"] }),
    customersBehavior: () => ({ ok: true, nodes: [{ id: `gid://shopify/Customer/${CUSTOMER_ID}`, displayName: CUSTOMER_NAME, email: CUSTOMER_EMAIL }] })
  });
  const diagnostics = await diagnoseShopifyIdentity({ getConfig: () => CLIENT_CREDENTIALS_CONFIG, fetchImpl, sampleCustomerId: CUSTOMER_ID });
  assert.equal(diagnostics.customerLookup, "resolved_full");
});

test("diagnoseShopifyIdentity: a sample customerId resolves partially (name only, email redacted)", async () => {
  const fetchImpl = fakeShopify({
    scopesBehavior: () => ({ ok: true, scopes: ["read_customers"] }),
    customersBehavior: () => ({ ok: true, nodes: [{ id: `gid://shopify/Customer/${CUSTOMER_ID}`, displayName: CUSTOMER_NAME, email: null }] })
  });
  const diagnostics = await diagnoseShopifyIdentity({ getConfig: () => CLIENT_CREDENTIALS_CONFIG, fetchImpl, sampleCustomerId: CUSTOMER_ID });
  assert.equal(diagnostics.customerLookup, "resolved_partial");
});

test("diagnoseShopifyIdentity: a sample customerId comes back with the node present but both fields empty", async () => {
  const fetchImpl = fakeShopify({
    scopesBehavior: () => ({ ok: true, scopes: ["read_customers"] }),
    customersBehavior: () => ({ ok: true, nodes: [{ id: `gid://shopify/Customer/${CUSTOMER_ID}`, displayName: null, email: null }] })
  });
  const diagnostics = await diagnoseShopifyIdentity({ getConfig: () => CLIENT_CREDENTIALS_CONFIG, fetchImpl, sampleCustomerId: CUSTOMER_ID });
  assert.equal(diagnostics.customerLookup, "resolved_empty");
});

test("diagnoseShopifyIdentity: a sample customerId that is not found/denied", async () => {
  const fetchImpl = fakeShopify({
    scopesBehavior: () => ({ ok: true, scopes: ["read_customers"] }),
    customersBehavior: () => ({ ok: true, nodes: [null] })
  });
  const diagnostics = await diagnoseShopifyIdentity({ getConfig: () => CLIENT_CREDENTIALS_CONFIG, fetchImpl, sampleCustomerId: CUSTOMER_ID });
  assert.equal(diagnostics.customerLookup, "not_found_or_denied");
});

test("diagnoseShopifyIdentity: a sample customerId lookup that fails outright (e.g. access denied)", async () => {
  const fetchImpl = fakeShopify({
    scopesBehavior: () => ({ ok: true, scopes: [] }),
    customersBehavior: () => ({ ok: true, responseBody: { errors: [{ message: "denied", extensions: { code: "ACCESS_DENIED" } }] } })
  });
  const diagnostics = await diagnoseShopifyIdentity({ getConfig: () => CLIENT_CREDENTIALS_CONFIG, fetchImpl, sampleCustomerId: CUSTOMER_ID });
  assert.equal(diagnostics.customerLookup, "failed");
  assert.equal(diagnostics.readCustomersGranted, false);
});

// ============ routes/admin/identity-diagnostics.js ============

test("GET /api/admin/identity-diagnostics requires admin credentials", async () => {
  await withAdminEnv(async () => {
    const res = createMockNodeResponse();
    await identityDiagnosticsHandler({ method: "GET", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 401);
  });
});

test("GET /api/admin/identity-diagnostics rejects a customer Learning Progress bearer JWT", async () => {
  await withAdminEnv(async () => {
    const res = createMockNodeResponse();
    await identityDiagnosticsHandler({ method: "GET", headers: { authorization: customerBearerHeader() }, query: {} }, res);
    assert.equal(res.statusCode, 401);
  });
});

test("GET /api/admin/identity-diagnostics rejects wrong admin credentials", async () => {
  await withAdminEnv(async () => {
    const res = createMockNodeResponse();
    await identityDiagnosticsHandler({ method: "GET", headers: { authorization: basicAuthHeader(ADMIN_USERNAME, "wrong") }, query: {} }, res);
    assert.equal(res.statusCode, 401);
  });
});

test("GET /api/admin/identity-diagnostics rejects non-GET methods", async () => {
  await withAdminEnv(async () => {
    const res = createMockNodeResponse();
    await identityDiagnosticsHandler({ method: "POST", headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) }, query: {} }, res);
    assert.equal(res.statusCode, 405);
  });
});

test("GET /api/admin/identity-diagnostics returns only the documented safe fields, never a token", async () => {
  await withAdminEnv(async () => {
    const req = { method: "GET", headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) }, query: {} };
    const res = createMockNodeResponse();
    await identityDiagnosticsHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(res.jsonBody).sort(), ["adminApiAuthenticated", "customerLookup", "readCustomersGranted", "scopeCheck"]);
    const serialized = JSON.stringify(res.jsonBody);
    assert.ok(!serialized.toLowerCase().includes("token"));
    assert.ok(!serialized.toLowerCase().includes("secret"));
  });
});

test("GET /api/admin/identity-diagnostics?customerId=<id> is accepted and never echoed back in the response", async () => {
  await withAdminEnv(async () => {
    const req = {
      method: "GET",
      headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) },
      query: { customerId: CUSTOMER_ID }
    };
    const res = createMockNodeResponse();
    await identityDiagnosticsHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(!JSON.stringify(res.jsonBody).includes(CUSTOMER_ID));
  });
});
