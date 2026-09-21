// Integration test against the REAL, unmodified api/customer-auth/start.js
// handler -- not a re-implementation of it. Only the global `fetch` used for
// OIDC discovery is mocked (no network). This specifically guards against
// the live incident where the callback had code+state but no transaction
// cookie: proving /start's single response actually carries both
// Set-Cookie and Location, with the cookie attributes a browser needs to
// send it back on the redirect from Shopify.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/customer-auth/start.js";
import { verifyOAuthTransaction } from "../lib/oauth-transaction.js";
import { parseSetCookieAttributes, createMockNodeResponse, withEnv } from "./cookie-test-utils.js";

const SESSION_SECRET = "test-session-secret";
const SHOP_STOREFRONT_DOMAIN = "oceansoptics.com";
const CLIENT_ID = "test-client-id";

async function withMockDiscoveryFetch(fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, `https://${SHOP_STOREFRONT_DOMAIN}/.well-known/openid-configuration`);
    return {
      ok: true,
      json: async () => ({
        authorization_endpoint: "https://oceansoptics.com/authentication/oauth/authorize",
        token_endpoint: "https://oceansoptics.com/authentication/oauth/token",
        jwks_uri: "https://oceansoptics.com/authentication/oauth/jwks",
        issuer: "https://oceansoptics.com"
      })
    };
  };

  try {
    return await withEnv({ SHOP_STOREFRONT_DOMAIN, SHOPIFY_CLIENT_ID: CLIENT_ID, SESSION_TOKEN_SECRET: SESSION_SECRET }, fn);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("GET /api/customer-auth/start returns one response with both Set-Cookie and Location, status 302", async () => {
  await withMockDiscoveryFetch(async () => {
    const req = { method: "GET" };
    const res = createMockNodeResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 302);
    assert.ok(res.getHeader("Location"), "Location header must be present in the same response");
    assert.ok(res.getHeader("Set-Cookie"), "Set-Cookie header must be present in the same response");

    const location = new URL(res.getHeader("Location"));
    assert.equal(location.origin + location.pathname, "https://oceansoptics.com/authentication/oauth/authorize");
    assert.equal(location.searchParams.get("client_id"), CLIENT_ID);
    assert.equal(location.searchParams.get("response_type"), "code");
    assert.equal(location.searchParams.get("code_challenge_method"), "S256");

    const { name, attributes } = parseSetCookieAttributes(res.getHeader("Set-Cookie"));
    assert.equal(name, "oo_lp_oauth_txn");
    assert.equal("httponly" in attributes, true, "must be HttpOnly");
    assert.equal("secure" in attributes, true, "must be Secure");
    assert.equal(attributes.samesite, "Lax");
    assert.equal(attributes.path, "/api/customer-auth");
    assert.ok(Number(attributes["max-age"]) <= 600, "Max-Age must be at most 10 minutes");
    assert.ok(Number(attributes["max-age"]) > 0, "Max-Age must be positive");
  });
});

test("a valid relative return_to is validated and carried inside the signed transaction cookie", async () => {
  await withMockDiscoveryFetch(async () => {
    const req = { method: "GET", query: { return_to: "/pages/learn/r05-choosing-a-mask" } };
    const res = createMockNodeResponse();

    await handler(req, res);

    const { name } = parseSetCookieAttributes(res.getHeader("Set-Cookie"));
    assert.equal(name, "oo_lp_oauth_txn");
    const cookiePart = res.getHeader("Set-Cookie").split(";")[0];
    const rawValue = cookiePart.slice(cookiePart.indexOf("=") + 1);
    const result = verifyOAuthTransaction(rawValue, { secret: SESSION_SECRET });
    assert.equal(result.valid, true);
    assert.equal(result.returnPath, "/pages/learn/r05-choosing-a-mask");
  });
});

test("missing return_to defaults the transaction's stored return path to /pages/learn", async () => {
  await withMockDiscoveryFetch(async () => {
    const req = { method: "GET" };
    const res = createMockNodeResponse();

    await handler(req, res);

    const cookiePart = res.getHeader("Set-Cookie").split(";")[0];
    const rawValue = cookiePart.slice(cookiePart.indexOf("=") + 1);
    const result = verifyOAuthTransaction(rawValue, { secret: SESSION_SECRET });
    assert.equal(result.valid, true);
    assert.equal(result.returnPath, "/pages/learn");
  });
});

test("an open-redirect return_to is sanitized to the default before it ever reaches the transaction", async () => {
  await withMockDiscoveryFetch(async () => {
    const req = { method: "GET", query: { return_to: "https://evil.example" } };
    const res = createMockNodeResponse();

    await handler(req, res);

    const cookiePart = res.getHeader("Set-Cookie").split(";")[0];
    const rawValue = cookiePart.slice(cookiePart.indexOf("=") + 1);
    const result = verifyOAuthTransaction(rawValue, { secret: SESSION_SECRET });
    assert.equal(result.valid, true);
    assert.equal(result.returnPath, "/pages/learn");
  });
});

test("GET /api/customer-auth/start rejects non-GET methods before touching Shopify", async () => {
  const req = { method: "POST" };
  const res = createMockNodeResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.jsonBody.error, "method_not_allowed");
  assert.equal(res.getHeader("Set-Cookie"), undefined, "must not set a transaction cookie for a rejected request");
});
