import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/customer-auth/exchange.js";
import { exchangeAuthHandoff } from "../lib/customer-auth-exchange-service.js";
import { createAuthHandoff, consumeAuthHandoff } from "../lib/auth-handoff.js";
import { verifySessionToken, mintSessionToken } from "../lib/session-token.js";
import { createFakeSupabase } from "./fake-supabase.js";
import { createMockNodeResponse } from "./cookie-test-utils.js";

const SESSION_SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";

async function seedHandoff(supabase, shopifyCustomerId) {
  const { data } = await supabase.from("learning_users").insert({ shopify_customer_id: shopifyCustomerId });
  const userId = data[0].id;
  return createAuthHandoff(supabase, userId);
}

// ---- Service-level tests (lib/customer-auth-exchange-service.js) ----

test("service: correct Learning Progress token minted after atomic consume", async () => {
  const supabase = createFakeSupabase();
  const rawCode = await seedHandoff(supabase, "777000777");

  const result = await exchangeAuthHandoff({
    handoff: rawCode,
    sessionTokenSecret: SESSION_SECRET,
    shopifyShopDomain: SHOP,
    getSupabaseClient: async () => supabase,
    consumeAuthHandoff,
    mintSessionToken
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.authenticated, true);
  const verified = verifySessionToken(result.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
  assert.equal(verified.valid, true);
  assert.equal(verified.payload.shopify_customer_id, "777000777");
  assert.deepEqual(Object.keys(result.body).sort(), ["authenticated", "token"]);
});

test("service: an unknown (never-issued) but well-formed handoff is rejected generically", async () => {
  const supabase = createFakeSupabase();
  const result = await exchangeAuthHandoff({
    handoff: "not-even-close-to-a-real-code-but-shaped-like-one",
    sessionTokenSecret: SESSION_SECRET,
    shopifyShopDomain: SHOP,
    getSupabaseClient: async () => supabase,
    consumeAuthHandoff,
    mintSessionToken
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "invalid_or_expired_handoff");
});

test("service: an empty-string handoff is rejected before any database work", async () => {
  const result = await exchangeAuthHandoff({
    handoff: "",
    sessionTokenSecret: SESSION_SECRET,
    shopifyShopDomain: SHOP,
    getSupabaseClient: async () => {
      throw new Error("must not be reached for an empty handoff");
    },
    consumeAuthHandoff,
    mintSessionToken
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "invalid_handoff");
});

test("service: rejects a non-string handoff", async () => {
  const result = await exchangeAuthHandoff({
    handoff: 12345,
    sessionTokenSecret: SESSION_SECRET,
    shopifyShopDomain: SHOP,
    getSupabaseClient: async () => {
      throw new Error("must not reach Supabase for an obviously invalid handoff");
    },
    consumeAuthHandoff,
    mintSessionToken
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "invalid_handoff");
});

// ---- Route handler tests (api/customer-auth/exchange.js) ----

function jsonRequest({ method = "POST", body, contentType = "application/json" } = {}) {
  return {
    method,
    headers: contentType ? { "content-type": contentType } : {},
    body
  };
}

test("route: rejects non-POST methods", async () => {
  const req = jsonRequest({ method: "GET" });
  const res = createMockNodeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.jsonBody.error, "method_not_allowed");
});

test("route: rejects the wrong Content-Type", async () => {
  const req = jsonRequest({ body: { handoff: "x".repeat(43) }, contentType: "text/plain" });
  const res = createMockNodeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 415);
});

test("route: rejects a malformed body (not an object)", async () => {
  const req = jsonRequest({ body: "just a string, not JSON" });
  const res = createMockNodeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.jsonBody.error, "malformed_body");
});

test("route: rejects a missing/malformed handoff field", async () => {
  const req = jsonRequest({ body: {} });
  const res = createMockNodeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.jsonBody.error, "invalid_handoff");
});

test("route: CORS allows only the configured storefront origin, never reflecting an arbitrary Origin", async () => {
  const req = { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: { handoff: "x".repeat(43) } };
  const res = createMockNodeResponse();
  await handler(req, res);
  assert.equal(res.getHeader("Access-Control-Allow-Origin"), "https://oceansoptics.com");
  assert.notEqual(res.getHeader("Access-Control-Allow-Origin"), "https://evil.example");
  assert.notEqual(res.getHeader("Access-Control-Allow-Origin"), "*");
});

test("route: OPTIONS preflight succeeds with the headers POST + Authorization usage require", async () => {
  const req = { method: "OPTIONS", headers: { origin: "https://oceansoptics.com" } };
  const res = createMockNodeResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 204);
  assert.equal(res.getHeader("Access-Control-Allow-Origin"), "https://oceansoptics.com");
  assert.ok(res.getHeader("Access-Control-Allow-Methods").includes("POST"));
  assert.ok(res.getHeader("Access-Control-Allow-Headers").includes("Content-Type"));
  assert.ok(res.getHeader("Access-Control-Allow-Headers").includes("Authorization"));
});

test("route: never logs the handoff value, even on failure", async () => {
  const originalConsoleError = console.error;
  const loggedArgs = [];
  console.error = (...args) => loggedArgs.push(args);

  const secretLookingCode = "s3cr3t-handoff-value-that-must-never-appear-in-logs-01234";
  try {
    const req = jsonRequest({ body: { handoff: secretLookingCode } });
    const res = createMockNodeResponse();
    await handler(req, res);
  } finally {
    console.error = originalConsoleError;
  }

  const serializedLogs = JSON.stringify(loggedArgs);
  assert.ok(!serializedLogs.includes(secretLookingCode));
});
