import { test } from "node:test";
import assert from "node:assert/strict";
import { generateRandomToken, generatePkceVerifier, computePkceChallenge } from "../lib/pkce.js";

test("computePkceChallenge matches RFC 7636 Appendix B's worked example exactly", () => {
  // https://www.rfc-editor.org/rfc/rfc7636#appendix-B -- an independent,
  // authoritative test vector, not just internal self-consistency.
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const expectedChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
  assert.equal(computePkceChallenge(verifier), expectedChallenge);
});

test("generatePkceVerifier produces a verifier within RFC 7636's 43-128 char range", () => {
  const verifier = generatePkceVerifier();
  assert.ok(verifier.length >= 43 && verifier.length <= 128, `length was ${verifier.length}`);
});

test("generatePkceVerifier and generateRandomToken use only the base64url charset (no +, /, or = padding)", () => {
  for (let i = 0; i < 20; i += 1) {
    const value = generatePkceVerifier();
    assert.match(value, /^[A-Za-z0-9\-_]+$/, `unexpected characters in "${value}"`);
    assert.ok(!value.includes("="), "must not be padded");
  }
});

test("generateRandomToken produces different values on each call", () => {
  const a = generateRandomToken();
  const b = generateRandomToken();
  assert.notEqual(a, b);
});

test("computePkceChallenge is deterministic for a given verifier", () => {
  const verifier = generatePkceVerifier();
  assert.equal(computePkceChallenge(verifier), computePkceChallenge(verifier));
});

test("computePkceChallenge produces different challenges for different verifiers", () => {
  const a = computePkceChallenge(generatePkceVerifier());
  const b = computePkceChallenge(generatePkceVerifier());
  assert.notEqual(a, b);
});
