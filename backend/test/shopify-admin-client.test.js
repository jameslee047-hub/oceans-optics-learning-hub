import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getShopifyAdminConfig,
  getShopifyAdminAccessToken,
  fetchShopifyCustomersByIds,
  shopifyAdminCustomerUrl
} from "../lib/shopify-admin-client.js";

// ---------------- getShopifyAdminConfig ----------------

test("getShopifyAdminConfig: client_credentials is preferred when both clientId+secret and a static token are present", () => {
  const config = getShopifyAdminConfig({
    SHOPIFY_SHOP_DOMAIN: "a44b34.myshopify.com",
    SHOPIFY_CLIENT_ID: "client-id",
    SHOPIFY_API_SECRET: "client-secret",
    SHOPIFY_ADMIN_API_ACCESS_TOKEN: "legacy-token"
  });
  assert.equal(config.authMode, "client_credentials");
  assert.equal(config.configured, true);
});

test("getShopifyAdminConfig: falls back to legacy_admin_access_token when only a static token is set", () => {
  const config = getShopifyAdminConfig({
    SHOPIFY_SHOP_DOMAIN: "a44b34.myshopify.com",
    SHOPIFY_ADMIN_API_ACCESS_TOKEN: "legacy-token"
  });
  assert.equal(config.authMode, "legacy_admin_access_token");
  assert.equal(config.configured, true);
});

test("getShopifyAdminConfig: not configured when neither credential is present", () => {
  const config = getShopifyAdminConfig({ SHOPIFY_SHOP_DOMAIN: "a44b34.myshopify.com" });
  assert.equal(config.authMode, "missing");
  assert.equal(config.configured, false);
});

test("getShopifyAdminConfig: not configured without a shop domain, even with credentials present", () => {
  const config = getShopifyAdminConfig({ SHOPIFY_CLIENT_ID: "client-id", SHOPIFY_API_SECRET: "client-secret" });
  assert.equal(config.configured, false);
});

// ---------------- getShopifyAdminAccessToken ----------------

test("getShopifyAdminAccessToken: legacy mode returns the static token directly, with no network call", async () => {
  const config = { authMode: "legacy_admin_access_token", staticAccessToken: "legacy-token" };
  let called = false;
  const token = await getShopifyAdminAccessToken(config, { fetchImpl: async () => { called = true; } });
  assert.equal(token, "legacy-token");
  assert.equal(called, false);
});

test("getShopifyAdminAccessToken: client_credentials mode posts the correct grant to the shop's OAuth token endpoint", async () => {
  const config = {
    authMode: "client_credentials",
    shopDomain: "a44b34.myshopify.com",
    clientId: "my-client-id",
    clientSecret: "my-client-secret"
  };
  let capturedUrl, capturedBody, capturedHeaders;
  const fetchImpl = async (url, options) => {
    capturedUrl = url;
    capturedHeaders = options.headers;
    capturedBody = new URLSearchParams(options.body);
    return { ok: true, json: async () => ({ access_token: "minted-token", expires_in: 3600 }) };
  };
  const token = await getShopifyAdminAccessToken(config, { fetchImpl });
  assert.equal(token, "minted-token");
  assert.equal(capturedUrl, "https://a44b34.myshopify.com/admin/oauth/access_token");
  assert.equal(capturedHeaders["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(capturedBody.get("grant_type"), "client_credentials");
  assert.equal(capturedBody.get("client_id"), "my-client-id");
  assert.equal(capturedBody.get("client_secret"), "my-client-secret");
});

test("getShopifyAdminAccessToken: throws when not configured at all", async () => {
  await assert.rejects(() => getShopifyAdminAccessToken({ authMode: "missing" }), /shopify_admin_not_configured/);
});

test("getShopifyAdminAccessToken: throws on a network error", async () => {
  const config = { authMode: "client_credentials", shopDomain: "shop.myshopify.com", clientId: "a", clientSecret: "b" };
  await assert.rejects(
    () => getShopifyAdminAccessToken(config, { fetchImpl: async () => { throw new Error("boom"); } }),
    /shopify_admin_token_network_error/
  );
});

test("getShopifyAdminAccessToken: throws on a non-2xx response", async () => {
  const config = { authMode: "client_credentials", shopDomain: "shop.myshopify.com", clientId: "a", clientSecret: "b" };
  await assert.rejects(
    () => getShopifyAdminAccessToken(config, { fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }) }),
    /shopify_admin_token_http_401/
  );
});

test("getShopifyAdminAccessToken: throws when the response has no access_token", async () => {
  const config = { authMode: "client_credentials", shopDomain: "shop.myshopify.com", clientId: "a", clientSecret: "b" };
  await assert.rejects(
    () => getShopifyAdminAccessToken(config, { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }),
    /shopify_admin_token_missing/
  );
});

// ---------------- fetchShopifyCustomersByIds ----------------

test("fetchShopifyCustomersByIds: returns an empty map with no network call for an empty id list", async () => {
  let called = false;
  const result = await fetchShopifyCustomersByIds({
    shopDomain: "shop.myshopify.com",
    accessToken: "token",
    numericCustomerIds: [],
    fetchImpl: async () => { called = true; }
  });
  assert.equal(result.size, 0);
  assert.equal(called, false);
});

test("fetchShopifyCustomersByIds: builds Customer GIDs, sends the access token header, and maps results back by numeric id", async () => {
  let capturedUrl, capturedHeaders, capturedBody;
  const fetchImpl = async (url, options) => {
    capturedUrl = url;
    capturedHeaders = options.headers;
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        data: {
          nodes: [
            { id: "gid://shopify/Customer/111", displayName: "James Lee", email: "james@example.com" },
            { id: "gid://shopify/Customer/222", displayName: "Ada Lovelace", email: null }
          ]
        }
      })
    };
  };

  const result = await fetchShopifyCustomersByIds({
    shopDomain: "shop.myshopify.com",
    accessToken: "the-token",
    apiVersion: "2026-07",
    numericCustomerIds: ["111", "222"],
    fetchImpl
  });

  assert.equal(capturedUrl, "https://shop.myshopify.com/admin/api/2026-07/graphql.json");
  assert.equal(capturedHeaders["X-Shopify-Access-Token"], "the-token");
  assert.deepEqual(capturedBody.variables.ids, ["gid://shopify/Customer/111", "gid://shopify/Customer/222"]);

  assert.deepEqual(result.get("111"), { displayName: "James Lee", email: "james@example.com" });
  assert.deepEqual(result.get("222"), { displayName: "Ada Lovelace", email: null });
});

test("fetchShopifyCustomersByIds: throws on a non-2xx response", async () => {
  await assert.rejects(
    () =>
      fetchShopifyCustomersByIds({
        shopDomain: "shop.myshopify.com",
        accessToken: "token",
        numericCustomerIds: ["1"],
        fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) })
      }),
    /shopify_admin_customers_http_429/
  );
});

test("fetchShopifyCustomersByIds: throws on a GraphQL errors array (e.g. a scope-denied response)", async () => {
  await assert.rejects(
    () =>
      fetchShopifyCustomersByIds({
        shopDomain: "shop.myshopify.com",
        accessToken: "token",
        numericCustomerIds: ["1"],
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ errors: [{ message: "Access denied for customers field. Required access: `read_customers` access scope." }] })
        })
      }),
    /shopify_admin_customers_graphql_error/
  );
});

test("fetchShopifyCustomersByIds: skips a node with an unparseable/non-Customer id instead of throwing", async () => {
  const result = await fetchShopifyCustomersByIds({
    shopDomain: "shop.myshopify.com",
    accessToken: "token",
    numericCustomerIds: ["1", "2"],
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        data: {
          nodes: [
            null,
            { id: "gid://shopify/Order/999", displayName: "not a customer" },
            { id: "gid://shopify/Customer/1", displayName: "Real Customer", email: "real@example.com" }
          ]
        }
      })
    })
  });
  assert.equal(result.size, 1);
  assert.deepEqual(result.get("1"), { displayName: "Real Customer", email: "real@example.com" });
});

// ---------------- shopifyAdminCustomerUrl ----------------

test("shopifyAdminCustomerUrl: builds the Shopify Admin customer link", () => {
  assert.equal(shopifyAdminCustomerUrl("a44b34.myshopify.com", "123456789"), "https://a44b34.myshopify.com/admin/customers/123456789");
});

test("shopifyAdminCustomerUrl: returns null without a shop domain", () => {
  assert.equal(shopifyAdminCustomerUrl("", "123456789"), null);
  assert.equal(shopifyAdminCustomerUrl(undefined, "123456789"), null);
});
