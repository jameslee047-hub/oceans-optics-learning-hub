import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverOidcConfiguration } from "../lib/shopify-discovery.js";

const VALID_CONFIG = {
  authorization_endpoint: "https://oceansoptics.com/authentication/oauth/authorize",
  token_endpoint: "https://oceansoptics.com/authentication/oauth/token",
  jwks_uri: "https://oceansoptics.com/authentication/oauth/jwks",
  issuer: "https://oceansoptics.com"
};

function fakeFetch(response) {
  return async () => response;
}

test("discovers a valid OIDC configuration and requests the well-known URL for the given domain", async () => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => VALID_CONFIG };
  };

  const config = await discoverOidcConfiguration("oceansoptics.com", { fetchImpl });
  assert.deepEqual(config, VALID_CONFIG);
  assert.equal(requestedUrl, "https://oceansoptics.com/.well-known/openid-configuration");
});

test("throws on a network error", async () => {
  const fetchImpl = async () => {
    throw new Error("boom");
  };
  await assert.rejects(() => discoverOidcConfiguration("oceansoptics.com", { fetchImpl }), /oidc_discovery_network_error/);
});

test("throws on a non-2xx HTTP response", async () => {
  const fetchImpl = fakeFetch({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(() => discoverOidcConfiguration("oceansoptics.com", { fetchImpl }), /oidc_discovery_http_503/);
});

test("throws when the response body is not valid JSON", async () => {
  const fetchImpl = fakeFetch({
    ok: true,
    json: async () => {
      throw new SyntaxError("Unexpected token");
    }
  });
  await assert.rejects(() => discoverOidcConfiguration("oceansoptics.com", { fetchImpl }), /oidc_discovery_invalid_json/);
});

test("throws when a required field is missing (never falls back to a hardcoded endpoint)", async () => {
  const incomplete = { ...VALID_CONFIG };
  delete incomplete.jwks_uri;
  const fetchImpl = fakeFetch({ ok: true, json: async () => incomplete });
  await assert.rejects(() => discoverOidcConfiguration("oceansoptics.com", { fetchImpl }), /oidc_discovery_missing_field:jwks_uri/);
});
