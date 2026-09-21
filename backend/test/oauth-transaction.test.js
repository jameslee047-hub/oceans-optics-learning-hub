import { test } from "node:test";
import assert from "node:assert/strict";
import { createOAuthTransaction, verifyOAuthTransaction } from "../lib/oauth-transaction.js";

const SECRET = "test-session-secret";

test("creates a transaction that verifies successfully with the same fields", () => {
  const token = createOAuthTransaction({ state: "state-1", nonce: "nonce-1", codeVerifier: "verifier-1", secret: SECRET });
  const result = verifyOAuthTransaction(token, { secret: SECRET });
  assert.equal(result.valid, true);
  assert.equal(result.state, "state-1");
  assert.equal(result.nonce, "nonce-1");
  assert.equal(result.codeVerifier, "verifier-1");
});

test("rejects a transaction token tampered after signing", () => {
  const token = createOAuthTransaction({ state: "state-1", nonce: "nonce-1", codeVerifier: "verifier-1", secret: SECRET });
  const [header, payload, signature] = token.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ state: "attacker-state", nonce: "nonce-1", code_verifier: "verifier-1", iat: 0, exp: 9_999_999_999 }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const tampered = `${header}.${forgedPayload}.${signature}`;

  const result = verifyOAuthTransaction(tampered, { secret: SECRET });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_signature");
});

test("rejects an expired transaction (past the ~10 minute lifetime)", () => {
  const fixedNow = () => 1_700_000_000_000;
  const token = createOAuthTransaction({ state: "s", nonce: "n", codeVerifier: "v", secret: SECRET, now: fixedNow });
  const later = () => fixedNow() + 11 * 60 * 1000; // 11 minutes later
  const result = verifyOAuthTransaction(token, { secret: SECRET, now: later });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "expired");
});

test("accepts a transaction right up to, but not past, its ~10 minute lifetime", () => {
  const fixedNow = () => 1_700_000_000_000;
  const token = createOAuthTransaction({ state: "s", nonce: "n", codeVerifier: "v", secret: SECRET, now: fixedNow });
  const justBefore = () => fixedNow() + 9 * 60 * 1000 + 59_000;
  const result = verifyOAuthTransaction(token, { secret: SECRET, now: justBefore });
  assert.equal(result.valid, true);
});

test("rejects a transaction verified with the wrong secret", () => {
  const token = createOAuthTransaction({ state: "s", nonce: "n", codeVerifier: "v", secret: SECRET });
  const result = verifyOAuthTransaction(token, { secret: "wrong-secret" });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_signature");
});

test("rejects a missing transaction cookie value", () => {
  const result = verifyOAuthTransaction(null, { secret: SECRET });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "missing_token");
});

test("rejects a malformed transaction token", () => {
  const result = verifyOAuthTransaction("not-a-real-token", { secret: SECRET });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "malformed_token");
});

test("createOAuthTransaction refuses to create an incomplete transaction", () => {
  assert.throws(() => createOAuthTransaction({ state: "", nonce: "n", codeVerifier: "v", secret: SECRET }));
  assert.throws(() => createOAuthTransaction({ state: "s", nonce: "", codeVerifier: "v", secret: SECRET }));
  assert.throws(() => createOAuthTransaction({ state: "s", nonce: "n", codeVerifier: "", secret: SECRET }));
});
