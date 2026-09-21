// Uses a locally generated test keypair and jose's real signing/verification
// code -- no network, but genuinely cryptographic (not a hand-rolled mock).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
import { verifyCustomerIdToken } from "../lib/customer-account-jwt.js";

const ISSUER = "https://oceansoptics.com";
const AUDIENCE = "test-client-id";
const KEY_ID = "test-key-1";

let signingKey;
let wrongSigningKey;
let jwks;

before(async () => {
  const pair = await generateKeyPair("RS256");
  signingKey = pair;

  const wrongPair = await generateKeyPair("RS256");
  wrongSigningKey = wrongPair;

  const publicJwk = await exportJWK(pair.publicKey);
  publicJwk.kid = KEY_ID;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  jwks = createLocalJWKSet({ keys: [publicJwk] });
});

function signToken({ signWith = signingKey.privateKey, kid = KEY_ID, ...claims } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    nonce: "expected-nonce",
    sub: "opaque-subject-123",
    ...claims
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(signWith);
}

test("verifies a correctly signed id_token and returns its payload", async () => {
  const token = await signToken();
  const payload = await verifyCustomerIdToken(token, { jwks, issuer: ISSUER, audience: AUDIENCE, expectedNonce: "expected-nonce" });
  assert.equal(payload.sub, "opaque-subject-123");
});

test("rejects an id_token signed with the wrong key", async () => {
  const token = await signToken({ signWith: wrongSigningKey.privateKey });
  await assert.rejects(() => verifyCustomerIdToken(token, { jwks, issuer: ISSUER, audience: AUDIENCE, expectedNonce: "expected-nonce" }));
});

test("rejects an id_token with the wrong issuer", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ nonce: "expected-nonce", sub: "opaque-subject-123" })
    .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
    .setIssuer("https://attacker.example")
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(signingKey.privateKey);

  await assert.rejects(() => verifyCustomerIdToken(token, { jwks, issuer: ISSUER, audience: AUDIENCE, expectedNonce: "expected-nonce" }));
});

test("rejects an id_token with the wrong audience", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ nonce: "expected-nonce", sub: "opaque-subject-123" })
    .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
    .setIssuer(ISSUER)
    .setAudience("some-other-client-id")
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(signingKey.privateKey);

  await assert.rejects(() => verifyCustomerIdToken(token, { jwks, issuer: ISSUER, audience: AUDIENCE, expectedNonce: "expected-nonce" }));
});

test("rejects an expired id_token", async () => {
  const past = Math.floor(Date.now() / 1000) - 3600;
  const token = await new SignJWT({ nonce: "expected-nonce", sub: "opaque-subject-123" })
    .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(past)
    .setExpirationTime(past + 60)
    .sign(signingKey.privateKey);

  await assert.rejects(() => verifyCustomerIdToken(token, { jwks, issuer: ISSUER, audience: AUDIENCE, expectedNonce: "expected-nonce" }));
});

test("rejects an id_token whose nonce does not match the OAuth transaction", async () => {
  const token = await signToken({ nonce: "a-different-nonce" });
  await assert.rejects(
    () => verifyCustomerIdToken(token, { jwks, issuer: ISSUER, audience: AUDIENCE, expectedNonce: "expected-nonce" }),
    /id_token_nonce_mismatch/
  );
});

test("rejects an id_token with no sub claim", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ nonce: "expected-nonce" })
    .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(signingKey.privateKey);

  await assert.rejects(
    () => verifyCustomerIdToken(token, { jwks, issuer: ISSUER, audience: AUDIENCE, expectedNonce: "expected-nonce" }),
    /id_token_missing_sub/
  );
});

test("rejects an id_token with an empty-string sub claim", async () => {
  const token = await signToken({ sub: "" });
  await assert.rejects(
    () => verifyCustomerIdToken(token, { jwks, issuer: ISSUER, audience: AUDIENCE, expectedNonce: "expected-nonce" }),
    /id_token_missing_sub/
  );
});

test("accepts a non-numeric, opaque sub with no assumed GID/numeric format", async () => {
  const token = await signToken({ sub: "z-opaque-non-numeric-subject" });
  const payload = await verifyCustomerIdToken(token, { jwks, issuer: ISSUER, audience: AUDIENCE, expectedNonce: "expected-nonce" });
  assert.equal(payload.sub, "z-opaque-non-numeric-subject");
});
