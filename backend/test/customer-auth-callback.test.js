import { test, before } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
import { completeCustomerAuthCallback } from "../lib/customer-auth-callback-service.js";
import { createOAuthTransaction } from "../lib/oauth-transaction.js";
import { verifyCustomerIdToken } from "../lib/customer-account-jwt.js";
import { exchangeAuthorizationCode } from "../lib/customer-account-token-exchange.js";
import { extractNumericCustomerId } from "../lib/shopify-customer-gid.js";
import { verifySessionToken, mintSessionToken } from "../lib/session-token.js";
import { createFakeSupabase } from "./fake-supabase.js";
import { findOrCreateLearningUser } from "../lib/supabase.js";

const SESSION_SECRET = "test-session-secret";
const SHOP_STOREFRONT_DOMAIN = "oceansoptics.com";
const CLIENT_ID = "test-client-id";
const SHOP = "a44b34.myshopify.com";
const REDIRECT_URI = "https://oceans-optics-learning-progress.vercel.app/api/customer-auth/callback";
const ISSUER = "https://oceansoptics.com";

const VALID_DISCOVERY = {
  authorization_endpoint: "https://oceansoptics.com/authentication/oauth/authorize",
  token_endpoint: "https://oceansoptics.com/authentication/oauth/token",
  jwks_uri: "https://oceansoptics.com/authentication/oauth/jwks",
  issuer: ISSUER
};

const VALID_CUSTOMER_ACCOUNT_API = {
  graphql_api: "https://oceansoptics.com/account/customer/api/unstable/graphql",
  mcp_api: "https://oceansoptics.com/account/customer/api/mcp"
};

let signingKey;
let jwks;

before(async () => {
  const pair = await generateKeyPair("RS256");
  signingKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  publicJwk.kid = "test-key-1";
  publicJwk.alg = "RS256";
  jwks = createLocalJWKSet({ keys: [publicJwk] });
});

function validTransactionCookie({ state = "state-1", nonce = "nonce-1", codeVerifier = "verifier-1" } = {}) {
  return createOAuthTransaction({ state, nonce, codeVerifier, secret: SESSION_SECRET });
}

function baseDeps(overrides = {}) {
  return {
    code: "auth-code",
    returnedState: "state-1",
    transactionCookieValue: validTransactionCookie(),
    sessionTokenSecret: SESSION_SECRET,
    shopStorefrontDomain: SHOP_STOREFRONT_DOMAIN,
    shopifyClientId: CLIENT_ID,
    shopifyShopDomain: SHOP,
    redirectUri: REDIRECT_URI,
    discoverOidcConfiguration: async () => VALID_DISCOVERY,
    exchangeAuthorizationCode: async () => ({ id_token: "irrelevant-in-most-tests", access_token: "test-access-token" }),
    createJwks: () => jwks,
    verifyCustomerIdToken: async () => ({ sub: "opaque-oidc-subject", nonce: "nonce-1" }),
    discoverCustomerAccountApi: async () => VALID_CUSTOMER_ACCOUNT_API,
    fetchAuthenticatedCustomerId: async () => "gid://shopify/Customer/555000111",
    extractNumericCustomerId,
    getSupabaseClient: async () => createFakeSupabase(),
    findOrCreateLearningUser,
    mintSessionToken,
    ...overrides
  };
}

test("rejects a request missing the authorization code", async () => {
  const result = await completeCustomerAuthCallback(baseDeps({ code: undefined }));
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "missing_code_or_state");
});

test("rejects a request missing state", async () => {
  const result = await completeCustomerAuthCallback(baseDeps({ returnedState: undefined }));
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "missing_code_or_state");
});

test("rejects a missing transaction cookie (e.g. cookie blocked or already consumed) with an unambiguous error code", async () => {
  const result = await completeCustomerAuthCallback(baseDeps({ transactionCookieValue: null }));
  assert.equal(result.status, 400);
  // Not the generic signed-token "missing_token" reason -- that reads as if
  // Shopify's own OAuth token were missing, which is exactly the ambiguity
  // that caused the live incident's error to be initially misread. This is
  // the actual live failure this whole hardening pass exists to make
  // unambiguous.
  assert.equal(result.body.error, "missing_oauth_transaction_cookie");
  assert.notEqual(result.body.error, "missing_token");
});

test("rejects a tampered transaction cookie", async () => {
  const token = validTransactionCookie();
  const [header, , signature] = token.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ state: "state-1", nonce: "nonce-1", code_verifier: "attacker-verifier", iat: 0, exp: 9_999_999_999 }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const tampered = `${header}.${forgedPayload}.${signature}`;

  const result = await completeCustomerAuthCallback(baseDeps({ transactionCookieValue: tampered }));
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "invalid_signature");
});

test("rejects an expired transaction cookie", async () => {
  const fixedNow = () => 1_700_000_000_000;
  const token = createOAuthTransaction({ state: "state-1", nonce: "nonce-1", codeVerifier: "verifier-1", secret: SESSION_SECRET, now: fixedNow });
  const result = await completeCustomerAuthCallback(baseDeps({ transactionCookieValue: token }));
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "expired");
});

test("rejects a mismatched state (returned state does not match the transaction)", async () => {
  const result = await completeCustomerAuthCallback(baseDeps({ returnedState: "attacker-supplied-state" }));
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "state_mismatch");
});

test("reports OIDC discovery failure distinctly", async () => {
  const result = await completeCustomerAuthCallback(
    baseDeps({
      discoverOidcConfiguration: async () => {
        throw new Error("oidc_discovery_http_503");
      }
    })
  );
  assert.equal(result.status, 502);
  assert.equal(result.body.error, "discovery_failed");
});

test("reports token exchange failure distinctly", async () => {
  const result = await completeCustomerAuthCallback(
    baseDeps({
      exchangeAuthorizationCode: async () => {
        throw new Error("token_exchange_http_400");
      }
    })
  );
  assert.equal(result.status, 502);
  assert.equal(result.body.error, "token_exchange_failed");
});

test("reports invalid id_token (signature/issuer/audience/nonce/etc.) as 401", async () => {
  const result = await completeCustomerAuthCallback(
    baseDeps({
      verifyCustomerIdToken: async () => {
        throw new Error("JWSSignatureVerificationFailed");
      }
    })
  );
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "invalid_id_token");
});

test("reports Customer Account API discovery failure distinctly", async () => {
  const result = await completeCustomerAuthCallback(
    baseDeps({
      discoverCustomerAccountApi: async () => {
        throw new Error("customer_account_api_discovery_http_503");
      }
    })
  );
  assert.equal(result.status, 502);
  assert.equal(result.body.error, "customer_account_api_discovery_failed");
});

test("reports a failed customer { id } query (network/HTTP/GraphQL error) distinctly", async () => {
  const result = await completeCustomerAuthCallback(
    baseDeps({
      fetchAuthenticatedCustomerId: async () => {
        throw new Error("customer_account_api_graphql_error: 1 error(s)");
      }
    })
  );
  assert.equal(result.status, 502);
  assert.equal(result.body.error, "customer_account_api_query_failed");
});

test("rejects a malformed Customer GID", async () => {
  const result = await completeCustomerAuthCallback(
    baseDeps({ fetchAuthenticatedCustomerId: async () => "gid://shopify/Customer/not-numeric" })
  );
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "invalid_customer_gid");
});

test("rejects a non-Customer GID (e.g. an Order GID)", async () => {
  const result = await completeCustomerAuthCallback(
    baseDeps({ fetchAuthenticatedCustomerId: async () => "gid://shopify/Order/555000111" })
  );
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "invalid_customer_gid");
});

test("never leaks access_token/id_token/email/OIDC sub into the response body", async () => {
  const result = await completeCustomerAuthCallback(
    baseDeps({
      exchangeAuthorizationCode: async () => ({ id_token: "secret.id.token", access_token: "secret-access-token" }),
      verifyCustomerIdToken: async () => ({ sub: "opaque-oidc-subject-should-not-leak", email: "should-never-appear@example.com" })
    })
  );
  assert.equal(result.status, 200);
  const serialized = JSON.stringify(result.body);
  assert.ok(!serialized.includes("secret.id.token"));
  assert.ok(!serialized.includes("secret-access-token"));
  assert.ok(!serialized.includes("example.com"));
  assert.ok(!serialized.includes("opaque-oidc-subject"));
  assert.deepEqual(Object.keys(result.body).sort(), ["authenticated", "customerId", "token"]);
});

test("successful flow: find-or-creates the user by numeric shopify_customer_id and mints a valid Learning Progress token", async () => {
  const supabase = createFakeSupabase();
  const result = await completeCustomerAuthCallback(
    baseDeps({
      getSupabaseClient: async () => supabase,
      fetchAuthenticatedCustomerId: async () => "gid://shopify/Customer/555000999"
    })
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.authenticated, true);
  assert.equal(result.body.customerId, "555000999");

  assert.equal(supabase.tables.learning_users.length, 1);
  assert.equal(supabase.tables.learning_users[0].shopify_customer_id, "555000999");

  const verified = verifySessionToken(result.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
  assert.equal(verified.valid, true);
  assert.equal(verified.payload.shopify_customer_id, "555000999");
});

test("logging back in with the same customer reuses the same learning_users row (no duplicate)", async () => {
  const supabase = createFakeSupabase();
  await completeCustomerAuthCallback(
    baseDeps({ getSupabaseClient: async () => supabase, fetchAuthenticatedCustomerId: async () => "gid://shopify/Customer/555000999" })
  );
  await completeCustomerAuthCallback(
    baseDeps({
      transactionCookieValue: validTransactionCookie({ state: "state-2", nonce: "nonce-2", codeVerifier: "verifier-2" }),
      returnedState: "state-2",
      getSupabaseClient: async () => supabase,
      fetchAuthenticatedCustomerId: async () => "gid://shopify/Customer/555000999"
    })
  );

  assert.equal(supabase.tables.learning_users.length, 1);
});

test("end-to-end with real cryptographic ID token verification and real GID extraction (no fakes for either step)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const realIdToken = await new SignJWT({ nonce: "real-nonce", sub: "opaque-oidc-subject-real" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
    .setIssuer(ISSUER)
    .setAudience(CLIENT_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(signingKey);

  const supabase = createFakeSupabase();
  const result = await completeCustomerAuthCallback(
    baseDeps({
      transactionCookieValue: validTransactionCookie({ state: "state-3", nonce: "real-nonce", codeVerifier: "verifier-3" }),
      returnedState: "state-3",
      exchangeAuthorizationCode: async () => ({ id_token: realIdToken, access_token: "real-flow-access-token" }),
      verifyCustomerIdToken, // the real function, not a fake
      fetchAuthenticatedCustomerId: async ({ accessToken }) => {
        assert.equal(accessToken, "real-flow-access-token", "must use the access_token from the token exchange, not anything else");
        return "gid://shopify/Customer/555000777";
      },
      extractNumericCustomerId, // the real function
      getSupabaseClient: async () => supabase
    })
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.customerId, "555000777");
});

test("regression: the exact Shopify-documented token response shape {access_token, id_token, expires_in} flows through the REAL exchangeAuthorizationCode and does not produce missing_token", async () => {
  // Uses the real lib/customer-account-token-exchange.js (not a fake) with
  // only its fetchImpl mocked, so this exercises the same
  // request-shape/response-normalization code that runs in production --
  // not a re-implementation of it. This is the specific regression this
  // test guards: a live browser test once returned {"error":"missing_token"},
  // and this proves that error does NOT originate from a well-formed token
  // exchange response being mishandled (the actual root cause was the OAuth
  // transaction cookie being absent -- see the incident report -- but this
  // closes off the token-exchange-shape explanation definitively).
  const now = Math.floor(Date.now() / 1000);
  const realIdToken = await new SignJWT({ nonce: "regression-nonce", sub: "opaque-oidc-subject-regression" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
    .setIssuer(ISSUER)
    .setAudience(CLIENT_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(signingKey);

  let capturedAccessToken;
  const tokenEndpointFetch = async (url, init) => {
    assert.equal(url, VALID_DISCOVERY.token_endpoint);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/x-www-form-urlencoded");
    const params = new URLSearchParams(init.body);
    assert.equal(params.get("grant_type"), "authorization_code");
    assert.equal(params.has("client_secret"), false);
    return {
      ok: true,
      json: async () => ({
        access_token: "regression-access-token",
        id_token: realIdToken,
        expires_in: 3600
      })
    };
  };

  const supabase = createFakeSupabase();
  const result = await completeCustomerAuthCallback(
    baseDeps({
      transactionCookieValue: validTransactionCookie({ state: "state-regression", nonce: "regression-nonce", codeVerifier: "verifier-regression" }),
      returnedState: "state-regression",
      // The real function -- only fetchImpl is injected/mocked.
      exchangeAuthorizationCode: (args) => exchangeAuthorizationCode({ ...args, fetchImpl: tokenEndpointFetch }),
      verifyCustomerIdToken, // real
      fetchAuthenticatedCustomerId: async ({ accessToken }) => {
        capturedAccessToken = accessToken;
        return "gid://shopify/Customer/555000321";
      },
      extractNumericCustomerId, // real
      getSupabaseClient: async () => supabase
    })
  );

  assert.notEqual(result.body.error, "missing_token", "must not be misdiagnosed as a missing OAuth transaction cookie");
  assert.notEqual(result.body.error, "missing_oauth_transaction_cookie", "must not be misdiagnosed as a missing OAuth transaction cookie");
  assert.equal(result.status, 200);
  assert.equal(result.body.authenticated, true);
  assert.equal(result.body.customerId, "555000321");
  assert.equal(capturedAccessToken, "regression-access-token", "the real access_token from the exchange must reach the Customer Account API call");

  const verified = verifySessionToken(result.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
  assert.equal(verified.valid, true);
  assert.equal(verified.payload.shopify_customer_id, "555000321");
});

test("post-auth failure (e.g. Supabase error) is reported without exposing internals", async () => {
  const result = await completeCustomerAuthCallback(
    baseDeps({
      getSupabaseClient: async () => {
        throw new Error("supabase connection refused: internal-hostname:5432");
      }
    })
  );
  assert.equal(result.status, 500);
  assert.equal(result.body.error, "identity_finalization_failed");
  assert.ok(!JSON.stringify(result.body).includes("internal-hostname"));
});

test("bearer token minted from this flow cannot impersonate another customer", async () => {
  const supabase = createFakeSupabase();
  const resultA = await completeCustomerAuthCallback(
    baseDeps({ getSupabaseClient: async () => supabase, fetchAuthenticatedCustomerId: async () => "gid://shopify/Customer/111111111" })
  );
  const resultB = await completeCustomerAuthCallback(
    baseDeps({
      transactionCookieValue: validTransactionCookie({ state: "state-b", nonce: "nonce-b", codeVerifier: "verifier-b" }),
      returnedState: "state-b",
      getSupabaseClient: async () => supabase,
      fetchAuthenticatedCustomerId: async () => "gid://shopify/Customer/222222222"
    })
  );

  const verifiedA = verifySessionToken(resultA.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
  const verifiedB = verifySessionToken(resultB.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
  assert.equal(verifiedA.payload.shopify_customer_id, "111111111");
  assert.equal(verifiedB.payload.shopify_customer_id, "222222222");
  assert.notEqual(verifiedA.payload.shopify_customer_id, verifiedB.payload.shopify_customer_id);
});
