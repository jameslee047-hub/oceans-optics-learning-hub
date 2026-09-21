import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverCustomerAccountApi } from "../lib/customer-account-api-discovery.js";

test("discovers the Customer Account API config and requests the well-known URL for the given domain", async () => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => ({ graphql_api: "https://oceansoptics.com/account/customer/api/unstable/graphql" }) };
  };

  const config = await discoverCustomerAccountApi("oceansoptics.com", { fetchImpl });
  assert.equal(config.graphql_api, "https://oceansoptics.com/account/customer/api/unstable/graphql");
  assert.equal(requestedUrl, "https://oceansoptics.com/.well-known/customer-account-api");
});

test("accepts graphql_api alongside the document's other confirmed field (mcp_api)", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      graphql_api: "https://oceansoptics.com/account/customer/api/unstable/graphql",
      mcp_api: "https://oceansoptics.com/account/customer/api/mcp"
    })
  });

  const config = await discoverCustomerAccountApi("oceansoptics.com", { fetchImpl });
  assert.equal(config.graphql_api, "https://oceansoptics.com/account/customer/api/unstable/graphql");
});

test("throws on a network error", async () => {
  const fetchImpl = async () => {
    throw new Error("boom");
  };
  await assert.rejects(() => discoverCustomerAccountApi("oceansoptics.com", { fetchImpl }), /customer_account_api_discovery_network_error/);
});

test("throws on a non-2xx HTTP response", async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => discoverCustomerAccountApi("oceansoptics.com", { fetchImpl }), /customer_account_api_discovery_http_503/);
});

test("throws when the response body is not valid JSON", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => {
      throw new SyntaxError("bad json");
    }
  });
  await assert.rejects(() => discoverCustomerAccountApi("oceansoptics.com", { fetchImpl }), /customer_account_api_discovery_invalid_json/);
});

test("throws when the graphql_api field is missing (never falls back to a hardcoded endpoint)", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ mcp_api: "https://oceansoptics.com/account/customer/api/mcp" }) });
  await assert.rejects(
    () => discoverCustomerAccountApi("oceansoptics.com", { fetchImpl }),
    /customer_account_api_discovery_missing_field:graphql_api/
  );
});

test("throws when graphql_api is not a valid HTTPS URL", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ graphql_api: "not-a-url" }) });
  await assert.rejects(
    () => discoverCustomerAccountApi("oceansoptics.com", { fetchImpl }),
    /customer_account_api_discovery_invalid_url:graphql_api/
  );
});

test("throws when graphql_api is a non-HTTPS URL (e.g. http://)", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ graphql_api: "http://oceansoptics.com/account/customer/api/unstable/graphql" }) });
  await assert.rejects(
    () => discoverCustomerAccountApi("oceansoptics.com", { fetchImpl }),
    /customer_account_api_discovery_invalid_url:graphql_api/
  );
});
