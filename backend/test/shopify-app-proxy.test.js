import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAppProxySignature, verifyAppProxyRequest } from "../lib/shopify-app-proxy.js";

const SECRET = "test-app-secret-do-not-use-in-fixtures-elsewhere";

function signedParams(params) {
  const signature = computeAppProxySignature(params, SECRET);
  return { ...params, signature };
}

test("accepts a correctly signed request with a logged-in customer", () => {
  const params = signedParams({
    shop: "a44b34.myshopify.com",
    timestamp: "1700000000",
    logged_in_customer_id: "555000111",
    path_prefix: "/apps/learning-progress"
  });

  const result = verifyAppProxyRequest(params, SECRET);
  assert.equal(result.valid, true);
  assert.equal(result.loggedInCustomerId, "555000111");
  assert.equal(result.shop, "a44b34.myshopify.com");
});

test("treats an empty logged_in_customer_id as a valid, unauthenticated (guest) request", () => {
  const params = signedParams({
    shop: "a44b34.myshopify.com",
    timestamp: "1700000000",
    logged_in_customer_id: "",
    path_prefix: "/apps/learning-progress"
  });

  const result = verifyAppProxyRequest(params, SECRET);
  assert.equal(result.valid, true);
  assert.equal(result.loggedInCustomerId, null);
});

test("rejects a request with no signature at all", () => {
  const result = verifyAppProxyRequest(
    { shop: "a44b34.myshopify.com", logged_in_customer_id: "555000111" },
    SECRET
  );
  assert.equal(result.valid, false);
  assert.equal(result.loggedInCustomerId, null);
});

test("rejects a request signed with the wrong secret", () => {
  const params = { ...signedParams({ shop: "a44b34.myshopify.com", logged_in_customer_id: "555000111" }) };
  const result = verifyAppProxyRequest(params, "a-completely-different-secret");
  assert.equal(result.valid, false);
});

test("rejects a tampered logged_in_customer_id (signature no longer matches)", () => {
  const params = signedParams({
    shop: "a44b34.myshopify.com",
    timestamp: "1700000000",
    logged_in_customer_id: "555000111"
  });

  // An attacker changes the customer id after the fact, without knowing the
  // secret needed to recompute a matching signature.
  const tampered = { ...params, logged_in_customer_id: "999999999" };

  const result = verifyAppProxyRequest(tampered, SECRET);
  assert.equal(result.valid, false);
  assert.equal(result.loggedInCustomerId, null, "identity must never be read out of a request that failed verification");
});

test("rejects a request with any other parameter tampered after signing", () => {
  const params = signedParams({ shop: "a44b34.myshopify.com", logged_in_customer_id: "555000111" });
  const tampered = { ...params, shop: "attacker-shop.myshopify.com" };
  const result = verifyAppProxyRequest(tampered, SECRET);
  assert.equal(result.valid, false);
});
