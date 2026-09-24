import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveShopifyIdentities, buildLearnerIdentity } from "../lib/learner-identity.js";

const CONFIGURED = {
  configured: true,
  authMode: "client_credentials",
  shopDomain: "shop.myshopify.com",
  clientId: "client-id",
  clientSecret: "client-secret",
  apiVersion: "2026-07"
};

function fakeShopifyFetch({ tokenOk = true, customersByBatch } = {}) {
  const graphqlCalls = [];
  const fetchImpl = async (url, options) => {
    if (url.includes("/admin/oauth/access_token")) {
      if (!tokenOk) return { ok: false, status: 401, json: async () => ({}) };
      return { ok: true, json: async () => ({ access_token: "minted-token", expires_in: 3600 }) };
    }
    if (url.includes("/graphql.json")) {
      const body = JSON.parse(options.body);
      const ids = body.variables.ids.map((gid) => gid.replace("gid://shopify/Customer/", ""));
      graphqlCalls.push(ids);
      const behavior = customersByBatch ? customersByBatch(ids, graphqlCalls.length) : { nodes: [] };
      if (behavior.throwHttp) return { ok: false, status: behavior.throwHttp, json: async () => ({}) };
      return { ok: true, json: async () => ({ data: { nodes: behavior.nodes || [] } }) };
    }
    throw new Error(`unexpected fetch to ${url}`);
  };
  return { fetchImpl, graphqlCalls };
}

function customerNode(id, displayName, email) {
  return { id: `gid://shopify/Customer/${id}`, displayName, email };
}

// ---------------- resolveShopifyIdentities ----------------

test("resolveShopifyIdentities: returns an empty map with no lookup attempted for an empty id list", async () => {
  let getConfigCalled = false;
  const result = await resolveShopifyIdentities([], {
    getConfig: () => { getConfigCalled = true; return CONFIGURED; },
    fetchImpl: async () => { throw new Error("must not be called"); }
  });
  assert.equal(result.size, 0);
  assert.equal(getConfigCalled, false);
});

test("resolveShopifyIdentities: returns an empty map (no network call) when Shopify admin lookup is not configured", async () => {
  let fetchCalled = false;
  const result = await resolveShopifyIdentities(["111"], {
    getConfig: () => ({ configured: false }),
    fetchImpl: async () => { fetchCalled = true; }
  });
  assert.equal(result.size, 0);
  assert.equal(fetchCalled, false);
});

test("resolveShopifyIdentities: resolves a single batch successfully", async () => {
  const { fetchImpl } = fakeShopifyFetch({
    customersByBatch: (ids) => ({ nodes: ids.map((id) => customerNode(id, `Name ${id}`, `${id}@example.com`)) })
  });
  const result = await resolveShopifyIdentities(["111", "222"], { getConfig: () => CONFIGURED, fetchImpl });
  assert.deepEqual(result.get("111"), { displayName: "Name 111", email: "111@example.com" });
  assert.deepEqual(result.get("222"), { displayName: "Name 222", email: "222@example.com" });
});

test("resolveShopifyIdentities: tolerates a bare JS number id (defense-in-depth against a Postgres bigint returned unconverted) instead of silently dropping it", async () => {
  // The real bug this guards: learning_users.shopify_customer_id is a
  // Postgres bigint, which PostgREST/supabase-js returns as a JS number,
  // not a string. The primary fix coerces it once at the source (see
  // lib/analytics-service.js), but this function must not silently drop a
  // number that reaches it anyway.
  const { fetchImpl, graphqlCalls } = fakeShopifyFetch({
    customersByBatch: (ids) => ({ nodes: ids.map((id) => customerNode(id, `Name ${id}`, `${id}@example.com`)) })
  });
  const result = await resolveShopifyIdentities([7662557626701], { getConfig: () => CONFIGURED, fetchImpl });
  assert.deepEqual(graphqlCalls, [["7662557626701"]], "the exact numeric value, converted losslessly to a string, not silently dropped");
  assert.deepEqual(result.get("7662557626701"), { displayName: "Name 7662557626701", email: "7662557626701@example.com" });
});

test("resolveShopifyIdentities: deduplicates repeated ids before looking them up", async () => {
  const { fetchImpl, graphqlCalls } = fakeShopifyFetch({
    customersByBatch: (ids) => ({ nodes: ids.map((id) => customerNode(id, `Name ${id}`, null)) })
  });
  await resolveShopifyIdentities(["111", "111", "111"], { getConfig: () => CONFIGURED, fetchImpl });
  assert.equal(graphqlCalls.flat().length, 1, "the duplicate ids must be looked up only once");
});

test("resolveShopifyIdentities: splits a large id list into multiple bounded batches and merges the results", async () => {
  const ids = Array.from({ length: 120 }, (_, i) => String(i + 1));
  const { fetchImpl, graphqlCalls } = fakeShopifyFetch({
    customersByBatch: (batchIds) => ({ nodes: batchIds.map((id) => customerNode(id, `Name ${id}`, null)) })
  });
  const result = await resolveShopifyIdentities(ids, { getConfig: () => CONFIGURED, fetchImpl });

  assert.ok(graphqlCalls.length >= 3, "120 ids at a bounded batch size well under 120 must produce multiple requests");
  graphqlCalls.forEach((batch) => assert.ok(batch.length <= 50, "each batch must stay well under Shopify's own 250-id nodes() limit"));
  assert.equal(result.size, 120, "every id across every batch must be present in the merged result");
  assert.equal(result.get("1").displayName, "Name 1");
  assert.equal(result.get("120").displayName, "Name 120");
});

test("resolveShopifyIdentities: an auth failure falls back to an empty map without throwing, and never attempts a customer lookup", async () => {
  const { fetchImpl, graphqlCalls } = fakeShopifyFetch({ tokenOk: false });
  const result = await resolveShopifyIdentities(["111"], { getConfig: () => CONFIGURED, fetchImpl });
  assert.equal(result.size, 0);
  assert.equal(graphqlCalls.length, 0);
});

test("resolveShopifyIdentities: one failed/rate-limited batch does not prevent other batches from resolving", async () => {
  const ids = Array.from({ length: 60 }, (_, i) => String(i + 1)); // two batches of <=50
  const { fetchImpl } = fakeShopifyFetch({
    customersByBatch: (batchIds, callNumber) => {
      if (callNumber === 1) return { throwHttp: 429 };
      return { nodes: batchIds.map((id) => customerNode(id, `Name ${id}`, null)) };
    }
  });
  const result = await resolveShopifyIdentities(ids, { getConfig: () => CONFIGURED, fetchImpl });
  assert.ok(result.size > 0, "the surviving batch must still resolve");
  assert.ok(result.size < ids.length, "the failed batch's customers must remain unresolved, not fabricated");
});

test("resolveShopifyIdentities: a GraphQL-level error (e.g. missing read_customers scope) degrades to an empty map, never throws", async () => {
  const { fetchImpl } = fakeShopifyFetch({
    customersByBatch: async () => {
      throw new Error("should not be reached directly; simulate via graphql errors instead");
    }
  });
  // Simulate a graphql errors[] response directly rather than a thrown fetch.
  const scopeDeniedFetch = async (url, options) => {
    if (url.includes("/admin/oauth/access_token")) return { ok: true, json: async () => ({ access_token: "token" }) };
    return { ok: true, json: async () => ({ errors: [{ message: "Access denied for customers field. Required access: `read_customers`." }] }) };
  };
  const result = await resolveShopifyIdentities(["111"], { getConfig: () => CONFIGURED, fetchImpl: scopeDeniedFetch });
  assert.equal(result.size, 0);
});

// ---------------- buildLearnerIdentity ----------------

test("buildLearnerIdentity: uses the resolved name/email and always includes a Shopify Admin link and fallback label", () => {
  const resolved = new Map([["111", { displayName: "James Lee", email: "james@example.com" }]]);
  const identity = buildLearnerIdentity("111", resolved, "shop.myshopify.com");
  assert.equal(identity.display_name, "James Lee");
  assert.equal(identity.email, "james@example.com");
  assert.equal(identity.shopify_admin_url, "https://shop.myshopify.com/admin/customers/111");
  assert.equal(identity.fallback_label, "Customer #111");
});

test("buildLearnerIdentity: an unresolved customer has null name/email but still a usable fallback label and admin link", () => {
  const identity = buildLearnerIdentity("999", new Map(), "shop.myshopify.com");
  assert.equal(identity.display_name, null);
  assert.equal(identity.email, null);
  assert.equal(identity.shopify_admin_url, "https://shop.myshopify.com/admin/customers/999");
  assert.equal(identity.fallback_label, "Customer #999");
});

test("buildLearnerIdentity: with no shop domain configured, the admin link is null but the fallback label still works", () => {
  const identity = buildLearnerIdentity("999", new Map(), "");
  assert.equal(identity.shopify_admin_url, null);
  assert.equal(identity.fallback_label, "Customer #999");
});
