// Confirms api/customer-auth/callback.js clears the OAuth transaction
// cookie using the SAME Path=/api/customer-auth that .../start.js set it
// with -- a mismatched Path means a browser's cookie-deletion request never
// actually targets the cookie /start created, leaving a stale (though
// still time-limited and single-use-checked) transaction cookie behind.
//
// These tests invoke the REAL, unmodified callback.js handler for two
// failure scenarios that need no external mocking (no code/state, and a
// missing transaction cookie -- the exact live incident). A third test
// proves, by inspecting callback.js's own source, that the same clearing
// call is unconditional -- it runs immediately after reading the incoming
// cookie, before completeCustomerAuthCallback (and therefore before
// success/failure is known) is ever called -- rather than building a full
// mock of the entire external OAuth/Customer-Account/Supabase chain just to
// re-observe a call that isn't gated by any of it. The successful flow
// itself is already covered end-to-end at the service layer by
// test/customer-auth-callback.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../api/customer-auth/callback.js";
import { parseSetCookieAttributes, createMockNodeResponse } from "./cookie-test-utils.js";

const CALLBACK_SOURCE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "api",
  "customer-auth",
  "callback.js"
);

function assertClearsTransactionCookie(res) {
  const setCookieHeader = res.getHeader("Set-Cookie");
  assert.ok(setCookieHeader, "Set-Cookie must be present to clear the transaction cookie");

  const { name, attributes } = parseSetCookieAttributes(setCookieHeader);
  assert.equal(name, "oo_lp_oauth_txn");
  assert.equal(attributes.path, "/api/customer-auth", "clearing cookie must use the SAME Path /start set it with");
  assert.equal(Number(attributes["max-age"]), 0, "clearing cookie must expire immediately");
}

test("callback failure (missing code/state) still clears the transaction cookie with the correct Path", async () => {
  const req = { method: "GET", query: {}, headers: {} };
  const res = createMockNodeResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.jsonBody.error, "missing_code_or_state");
  assertClearsTransactionCookie(res);
});

test("callback failure (code/state present, transaction cookie absent -- the live incident) still clears with the correct Path", async () => {
  const req = { method: "GET", query: { code: "test-code", state: "test-state" }, headers: {} };
  const res = createMockNodeResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.jsonBody.error, "missing_oauth_transaction_cookie");
  assertClearsTransactionCookie(res);
});

test("the clearing call is unconditional: it runs before completeCustomerAuthCallback, not gated by success or failure", () => {
  const source = fs.readFileSync(CALLBACK_SOURCE_PATH, "utf8");
  const clearIndex = source.indexOf("clearOAuthTransactionCookie()");
  const serviceCallIndex = source.indexOf("completeCustomerAuthCallback({");

  assert.ok(clearIndex !== -1, "callback.js must call clearOAuthTransactionCookie()");
  assert.ok(serviceCallIndex !== -1, "callback.js must call completeCustomerAuthCallback(");
  assert.ok(
    clearIndex < serviceCallIndex,
    "the transaction cookie must be cleared BEFORE the outcome is known, so the same call covers a successful flow too"
  );
});
