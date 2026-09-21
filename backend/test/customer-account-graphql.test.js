import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAuthenticatedCustomerId } from "../lib/customer-account-graphql.js";

const ENDPOINT = "https://oceansoptics.com/account/customer/api/unstable/graphql";

test("returns the customer GID from a successful response", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ data: { customer: { id: "gid://shopify/Customer/555000111" } } })
  });

  const gid = await fetchAuthenticatedCustomerId({ graphqlEndpoint: ENDPOINT, accessToken: "test-access-token", fetchImpl });
  assert.equal(gid, "gid://shopify/Customer/555000111");
});

test("sends the access token as the raw Authorization header value (no Bearer prefix)", async () => {
  let capturedInit;
  const fetchImpl = async (url, init) => {
    capturedInit = init;
    return { ok: true, json: async () => ({ data: { customer: { id: "gid://shopify/Customer/1" } } }) };
  };

  await fetchAuthenticatedCustomerId({ graphqlEndpoint: ENDPOINT, accessToken: "the-access-token", fetchImpl });

  // Per current Shopify Customer Account API docs, this endpoint expects
  // the raw access_token, not the standard OAuth "Bearer <token>" scheme.
  assert.equal(capturedInit.headers.Authorization, "the-access-token");
});

test("Authorization header never starts with \"Bearer \"", async () => {
  let capturedInit;
  const fetchImpl = async (url, init) => {
    capturedInit = init;
    return { ok: true, json: async () => ({ data: { customer: { id: "gid://shopify/Customer/1" } } }) };
  };

  await fetchAuthenticatedCustomerId({ graphqlEndpoint: ENDPOINT, accessToken: "another-access-token", fetchImpl });

  assert.equal(capturedInit.headers.Authorization.startsWith("Bearer "), false);
});

test("requests only customer.id -- the query string asks for nothing else", async () => {
  let capturedBody;
  const fetchImpl = async (url, init) => {
    capturedBody = JSON.parse(init.body);
    return { ok: true, json: async () => ({ data: { customer: { id: "gid://shopify/Customer/1" } } }) };
  };

  await fetchAuthenticatedCustomerId({ graphqlEndpoint: ENDPOINT, accessToken: "token", fetchImpl });

  assert.equal(capturedBody.query.replace(/\s+/g, " ").trim(), "query { customer { id } }");
  assert.ok(!/name|email|phone|address|orders/i.test(capturedBody.query), "must not request any other customer field");
});

test("posts to the discovered graphqlEndpoint, not a hardcoded URL", async () => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => ({ data: { customer: { id: "gid://shopify/Customer/1" } } }) };
  };
  await fetchAuthenticatedCustomerId({ graphqlEndpoint: ENDPOINT, accessToken: "token", fetchImpl });
  assert.equal(requestedUrl, ENDPOINT);
});

test("throws on a network error", async () => {
  const fetchImpl = async () => {
    throw new Error("network down");
  };
  await assert.rejects(
    () => fetchAuthenticatedCustomerId({ graphqlEndpoint: ENDPOINT, accessToken: "token", fetchImpl }),
    /customer_account_api_network_error/
  );
});

test("throws on a non-2xx HTTP response", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401 });
  await assert.rejects(
    () => fetchAuthenticatedCustomerId({ graphqlEndpoint: ENDPOINT, accessToken: "token", fetchImpl }),
    /customer_account_api_http_401/
  );
});

test("throws on a GraphQL errors array", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ errors: [{ message: "Access denied" }] })
  });
  await assert.rejects(
    () => fetchAuthenticatedCustomerId({ graphqlEndpoint: ENDPOINT, accessToken: "token", fetchImpl }),
    /customer_account_api_graphql_error/
  );
});

test("throws when no customer is returned (null customer, missing data)", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ data: { customer: null } }) });
  await assert.rejects(
    () => fetchAuthenticatedCustomerId({ graphqlEndpoint: ENDPOINT, accessToken: "token", fetchImpl }),
    /customer_account_api_missing_customer/
  );
});

test("throws when the response body is not valid JSON", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => {
      throw new SyntaxError("bad json");
    }
  });
  await assert.rejects(
    () => fetchAuthenticatedCustomerId({ graphqlEndpoint: ENDPOINT, accessToken: "token", fetchImpl }),
    /customer_account_api_invalid_json/
  );
});
