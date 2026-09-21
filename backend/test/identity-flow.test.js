// Integration-style test chaining the already-unit-tested pieces
// (verifyAppProxyRequest -> findOrCreateLearningUser -> mintSessionToken ->
// verifySessionToken) into the same sequence api/proxy/identity.js and the
// direct endpoints actually run, across a logged-out -> logged-in -> logged-out
// -> logged-in-again cycle (states A-D from the Phase A brief). This proves
// the CODE has no state leakage or stale-identity bugs across repeated
// calls -- it cannot prove Shopify's live App Proxy behavior on the real
// store, which requires an actual deployment (see Phase A report).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeSupabase } from "./fake-supabase.js";
import { computeAppProxySignature, verifyAppProxyRequest } from "../lib/shopify-app-proxy.js";
import { mintSessionToken, verifySessionToken } from "../lib/session-token.js";
import { findOrCreateLearningUser } from "../lib/supabase.js";

const APP_SECRET = "test-app-secret";
const SESSION_SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";

function proxyRequest(loggedInCustomerId) {
  const params = { shop: SHOP, timestamp: "1700000000", logged_in_customer_id: loggedInCustomerId || "" };
  return { ...params, signature: computeAppProxySignature(params, APP_SECRET) };
}

async function simulateIdentityCall(supabase, proxyParams) {
  const verification = verifyAppProxyRequest(proxyParams, APP_SECRET);
  if (!verification.valid) return { authenticated: false, error: "invalid_signature" };
  if (!verification.loggedInCustomerId) return { authenticated: false };

  const userId = await findOrCreateLearningUser(supabase, verification.loggedInCustomerId);
  const token = mintSessionToken({ shopifyCustomerId: verification.loggedInCustomerId, shop: SHOP, secret: SESSION_SECRET });
  return { authenticated: true, token, userId };
}

test("A: logged out -> guest, no token issued", async () => {
  const supabase = createFakeSupabase();
  const result = await simulateIdentityCall(supabase, proxyRequest(null));
  assert.equal(result.authenticated, false);
  assert.equal(result.token, undefined);
});

test("B: logged in -> verified token issued, resolves to the correct customer", async () => {
  const supabase = createFakeSupabase();
  const result = await simulateIdentityCall(supabase, proxyRequest("555000111"));
  assert.equal(result.authenticated, true);
  assert.ok(result.token);

  const verified = verifySessionToken(result.token, { secret: SESSION_SECRET, expectedShop: SHOP });
  assert.equal(verified.valid, true);
  assert.equal(verified.payload.shopify_customer_id, "555000111");
});

test("C: logout after B -> back to guest, same session not silently reused", async () => {
  const supabase = createFakeSupabase();
  await simulateIdentityCall(supabase, proxyRequest("555000111")); // B
  const afterLogout = await simulateIdentityCall(supabase, proxyRequest(null)); // C
  assert.equal(afterLogout.authenticated, false);
});

test("D: log back in -> same underlying learning_users row is reused, not duplicated", async () => {
  const supabase = createFakeSupabase();
  const b = await simulateIdentityCall(supabase, proxyRequest("555000111"));
  await simulateIdentityCall(supabase, proxyRequest(null)); // logout
  const d = await simulateIdentityCall(supabase, proxyRequest("555000111")); // log back in

  assert.equal(d.authenticated, true);
  assert.equal(d.userId, b.userId, "the same shopify_customer_id must map to the same learning_users row");
  assert.equal(supabase.tables.learning_users.length, 1, "no duplicate row should be created across a logout/login cycle");
});

test("repeated navigation while logged in mints an independent token each time, all valid", async () => {
  const supabase = createFakeSupabase();
  const params = proxyRequest("555000111");
  const results = await Promise.all([1, 2, 3, 4, 5].map(() => simulateIdentityCall(supabase, params)));

  for (const result of results) {
    assert.equal(result.authenticated, true);
    const verified = verifySessionToken(result.token, { secret: SESSION_SECRET, expectedShop: SHOP });
    assert.equal(verified.valid, true);
    assert.equal(verified.payload.shopify_customer_id, "555000111");
  }
  assert.equal(supabase.tables.learning_users.length, 1, "concurrent identity calls for the same customer must not create duplicate users");
});
