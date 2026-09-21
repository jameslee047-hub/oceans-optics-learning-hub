// Regression coverage for lib/oauth-cookie.js's readOAuthTransactionCookie,
// added after live-browser evidence showed the oo_lp_oauth_txn cookie WAS
// present on the real callback request, yet the deployed callback still
// treated the transaction as missing -- narrowing the bug to server-side
// cookie reading rather than the browser or /start.
//
// These tests exercise the REAL readOAuthTransactionCookie against
// realistic Cookie headers, and against the two request shapes Vercel could
// plausibly hand a serverless function (a plain Node headers object, and a
// Fetch-API-style Headers instance) so a shape mismatch can never again be
// invisible.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readOAuthTransactionCookie, serializeOAuthTransactionCookie } from "../lib/oauth-cookie.js";
import { createOAuthTransaction } from "../lib/oauth-transaction.js";
import { verifyOAuthTransaction } from "../lib/oauth-transaction.js";

const SECRET = "test-oauth-cookie-secret";

function realisticTransactionToken() {
  return createOAuthTransaction({
    state: "test-state",
    nonce: "test-nonce",
    codeVerifier: "test-code-verifier",
    returnPath: "/pages/learn",
    secret: SECRET
  });
}

function nodeStyleRequest(cookieHeader) {
  return { headers: { cookie: cookieHeader } };
}

function fetchStyleRequest(cookieHeader) {
  const map = new Map();
  if (cookieHeader !== undefined) map.set("cookie", cookieHeader);
  return {
    headers: {
      get(name) {
        return map.get(name.toLowerCase()) ?? null;
      }
    }
  };
}

test("extracts the transaction cookie when it is first in the header", () => {
  const token = realisticTransactionToken();
  const req = nodeStyleRequest(`oo_lp_oauth_txn=${token}; unrelated_cookie=abc; another_cookie=xyz`);
  const extracted = readOAuthTransactionCookie(req);
  assert.equal(extracted, token);
  assert.equal(verifyOAuthTransaction(extracted, { secret: SECRET }).valid, true);
});

test("extracts the transaction cookie when it is in the middle of the header", () => {
  const token = realisticTransactionToken();
  const req = nodeStyleRequest(`unrelated_cookie=abc; oo_lp_oauth_txn=${token}; another_cookie=xyz`);
  assert.equal(readOAuthTransactionCookie(req), token);
});

test("extracts the transaction cookie when it is last in the header", () => {
  const token = realisticTransactionToken();
  const req = nodeStyleRequest(`unrelated_cookie=abc; another_cookie=xyz; oo_lp_oauth_txn=${token}`);
  assert.equal(readOAuthTransactionCookie(req), token);
});

test("extracts correctly with no space after semicolons", () => {
  const token = realisticTransactionToken();
  const req = nodeStyleRequest(`unrelated_cookie=abc;oo_lp_oauth_txn=${token};another_cookie=xyz`);
  assert.equal(readOAuthTransactionCookie(req), token);
});

test("extracts correctly with extra whitespace around segments", () => {
  const token = realisticTransactionToken();
  const req = nodeStyleRequest(`  unrelated_cookie=abc  ;   oo_lp_oauth_txn=${token}   ; another_cookie=xyz  `);
  assert.equal(readOAuthTransactionCookie(req), token);
});

test("extracts correctly when it is the only cookie present", () => {
  const token = realisticTransactionToken();
  const req = nodeStyleRequest(`oo_lp_oauth_txn=${token}`);
  assert.equal(readOAuthTransactionCookie(req), token);
});

test("returns null when the transaction cookie is absent", () => {
  const req = nodeStyleRequest("unrelated_cookie=abc; another_cookie=xyz");
  assert.equal(readOAuthTransactionCookie(req), null);
});

test("returns null when there is no Cookie header at all", () => {
  const req = nodeStyleRequest(undefined);
  assert.equal(readOAuthTransactionCookie(req), null);
});

test("malformed unrelated cookies (no '=', stray ';') do not interfere with matching", () => {
  const token = realisticTransactionToken();
  const req = nodeStyleRequest(`flag_cookie_no_value; ;; oo_lp_oauth_txn=${token}; =dangling_value`);
  assert.equal(readOAuthTransactionCookie(req), token);
});

test("a cookie whose name merely starts with the transaction cookie's name is not mistaken for it", () => {
  const req = nodeStyleRequest("oo_lp_oauth_txn_backup=someone-elses-value; another=1");
  assert.equal(readOAuthTransactionCookie(req), null);
});

test("supports a Headers-style request object (req.headers.get) as well as a plain object", () => {
  const token = realisticTransactionToken();
  const req = fetchStyleRequest(`unrelated_cookie=abc; oo_lp_oauth_txn=${token}; another_cookie=xyz`);
  assert.equal(readOAuthTransactionCookie(req), token);
});

test("Headers-style request with no cookie header returns null instead of throwing", () => {
  const req = fetchStyleRequest(undefined);
  assert.equal(readOAuthTransactionCookie(req), null);
});

test("a Cookie header forwarded as an array (rather than pre-joined) is still parsed correctly", () => {
  const token = realisticTransactionToken();
  const req = { headers: { cookie: [`unrelated_cookie=abc`, `oo_lp_oauth_txn=${token}`] } };
  assert.equal(readOAuthTransactionCookie(req), token);
});

test("round-trips through the exact string serializeOAuthTransactionCookie produces", () => {
  const token = realisticTransactionToken();
  const setCookieHeader = serializeOAuthTransactionCookie(token);
  const cookiePart = setCookieHeader.split(";")[0];
  const req = nodeStyleRequest(`session_id=abc123; ${cookiePart}; theme=dark`);
  assert.equal(readOAuthTransactionCookie(req), token);
});
