import { test } from "node:test";
import assert from "node:assert/strict";
import { exchangeAuthorizationCode } from "../lib/customer-account-token-exchange.js";

test("exchanges a code for tokens with the expected request shape", async () => {
  let capturedUrl;
  let capturedInit;
  const fetchImpl = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return { ok: true, json: async () => ({ id_token: "fake.id.token", access_token: "fake-access-token" }) };
  };

  const result = await exchangeAuthorizationCode({
    tokenEndpoint: "https://oceansoptics.com/authentication/oauth/token",
    clientId: "client-123",
    redirectUri: "https://oceans-optics-learning-progress.vercel.app/api/customer-auth/callback",
    code: "auth-code",
    codeVerifier: "verifier-value",
    fetchImpl
  });

  assert.equal(result.id_token, "fake.id.token");
  assert.equal(capturedUrl, "https://oceansoptics.com/authentication/oauth/token");
  assert.equal(capturedInit.method, "POST");
});

test("PUBLIC client: sends no client_secret and no Authorization/Basic header", async () => {
  let capturedInit;
  const fetchImpl = async (url, init) => {
    capturedInit = init;
    return { ok: true, json: async () => ({ id_token: "fake.id.token" }) };
  };

  await exchangeAuthorizationCode({
    tokenEndpoint: "https://oceansoptics.com/authentication/oauth/token",
    clientId: "client-123",
    redirectUri: "https://example.test/callback",
    code: "auth-code",
    codeVerifier: "verifier-value",
    fetchImpl
  });

  const bodyParams = new URLSearchParams(capturedInit.body);
  assert.equal(bodyParams.has("client_secret"), false, "must never send client_secret");
  assert.equal(bodyParams.get("grant_type"), "authorization_code");
  assert.equal(bodyParams.get("client_id"), "client-123");
  assert.equal(bodyParams.get("code"), "auth-code");
  assert.equal(bodyParams.get("code_verifier"), "verifier-value");

  const headerNames = Object.keys(capturedInit.headers || {}).map((name) => name.toLowerCase());
  assert.equal(headerNames.includes("authorization"), false, "must never send a Basic/Authorization header");
});

test("throws on a non-2xx token endpoint response", async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({}) });
  await assert.rejects(
    () =>
      exchangeAuthorizationCode({
        tokenEndpoint: "https://oceansoptics.com/authentication/oauth/token",
        clientId: "client-123",
        redirectUri: "https://example.test/callback",
        code: "bad-code",
        codeVerifier: "verifier-value",
        fetchImpl
      }),
    /token_exchange_http_400/
  );
});

test("throws when the response has no id_token", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ access_token: "only-access-token" }) });
  await assert.rejects(
    () =>
      exchangeAuthorizationCode({
        tokenEndpoint: "https://oceansoptics.com/authentication/oauth/token",
        clientId: "client-123",
        redirectUri: "https://example.test/callback",
        code: "auth-code",
        codeVerifier: "verifier-value",
        fetchImpl
      }),
    /token_exchange_missing_id_token/
  );
});

test("throws on a network error talking to the token endpoint", async () => {
  const fetchImpl = async () => {
    throw new Error("network down");
  };
  await assert.rejects(
    () =>
      exchangeAuthorizationCode({
        tokenEndpoint: "https://oceansoptics.com/authentication/oauth/token",
        clientId: "client-123",
        redirectUri: "https://example.test/callback",
        code: "auth-code",
        codeVerifier: "verifier-value",
        fetchImpl
      }),
    /token_exchange_network_error/
  );
});
