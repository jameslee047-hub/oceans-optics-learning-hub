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
import { createAuthHandoff, consumeAuthHandoff } from "../lib/auth-handoff.js";
import { exchangeAuthHandoff } from "../lib/customer-auth-exchange-service.js";

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

function validTransactionCookie({ state = "state-1", nonce = "nonce-1", codeVerifier = "verifier-1", returnPath = "/pages/learn" } = {}) {
  return createOAuthTransaction({ state, nonce, codeVerifier, returnPath, secret: SESSION_SECRET });
}

function baseDeps(overrides = {}) {
  return {
    code: "auth-code",
    returnedState: "state-1",
    transactionCookieValue: validTransactionCookie(),
    sessionTokenSecret: SESSION_SECRET,
    shopStorefrontDomain: SHOP_STOREFRONT_DOMAIN,
    shopifyClientId: CLIENT_ID,
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
    createAuthHandoff,
    ...overrides
  };
}

// Extracts the one-time handoff code from the callback's redirect URL
// fragment -- never a query string or path segment, since browsers don't
// send URL fragments to any server.
function extractHandoffCode(redirectTo) {
  const url = new URL(redirectTo);
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  return params.get("oo_lp_handoff");
}

// Completes the full Phase B pipeline this callback now produces: takes a
// successful callback result (a 302 redirect carrying a handoff code) and
// exchanges that code the same way the storefront bootstrap script would,
// via the real exchange service, to get back the actual Learning Progress
// JWT. Used by tests that need to assert on the minted token/customer ID,
// since the callback itself no longer returns either directly.
async function exchangeCallbackResult(result, supabase) {
  assert.equal(result.status, 302);
  const handoffCode = extractHandoffCode(result.redirectTo);
  assert.ok(handoffCode, "redirect must carry a handoff code");

  return exchangeAuthHandoff({
    handoff: handoffCode,
    sessionTokenSecret: SESSION_SECRET,
    shopifyShopDomain: SHOP,
    getSupabaseClient: async () => supabase,
    consumeAuthHandoff,
    mintSessionToken
  });
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
  const token = createOAuthTransaction({ state: "state-1", nonce: "nonce-1", codeVerifier: "verifier-1", returnPath: "/pages/learn", secret: SESSION_SECRET, now: fixedNow });
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

test("never leaks access_token/id_token/email/OIDC sub/customerId/session token into the redirect", async () => {
  const result = await completeCustomerAuthCallback(
    baseDeps({
      exchangeAuthorizationCode: async () => ({ id_token: "secret.id.token", access_token: "secret-access-token" }),
      verifyCustomerIdToken: async () => ({ sub: "opaque-oidc-subject-should-not-leak", email: "should-never-appear@example.com" })
    })
  );
  assert.equal(result.status, 302);
  assert.equal(result.body, undefined, "a successful callback must not return a JSON body at all");

  assert.ok(!result.redirectTo.includes("secret.id.token"));
  assert.ok(!result.redirectTo.includes("secret-access-token"));
  assert.ok(!result.redirectTo.includes("example.com"));
  assert.ok(!result.redirectTo.includes("opaque-oidc-subject"));
  assert.ok(!result.redirectTo.includes("555000111"), "the numeric Shopify customer ID must not appear in the redirect either");

  // The ONLY thing the redirect carries is the fixed origin, the validated
  // return path, and a one-time opaque handoff code in the fragment.
  const url = new URL(result.redirectTo);
  assert.equal(url.origin, "https://oceansoptics.com");
  assert.equal(url.pathname, "/pages/learn");
  const handoffCode = extractHandoffCode(result.redirectTo);
  assert.ok(handoffCode);
  assert.equal(url.search, "");
});

test("successful flow: find-or-creates the user by numeric shopify_customer_id, issues a handoff, and the exchange mints a valid Learning Progress token", async () => {
  const supabase = createFakeSupabase();
  const result = await completeCustomerAuthCallback(
    baseDeps({
      getSupabaseClient: async () => supabase,
      fetchAuthenticatedCustomerId: async () => "gid://shopify/Customer/555000999"
    })
  );

  assert.equal(supabase.tables.learning_users.length, 1);
  assert.equal(supabase.tables.learning_users[0].shopify_customer_id, "555000999");

  const exchangeResult = await exchangeCallbackResult(result, supabase);
  assert.equal(exchangeResult.status, 200);
  assert.equal(exchangeResult.body.authenticated, true);

  const verified = verifySessionToken(exchangeResult.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
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

  const exchangeResult = await exchangeCallbackResult(result, supabase);
  const verified = verifySessionToken(exchangeResult.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
  assert.equal(verified.payload.shopify_customer_id, "555000777");
});

test("end-to-end succeeds with a real, cryptographically valid id_token that has NO sub claim at all", async () => {
  // Some real Shopify Customer Account API id_tokens have been observed in
  // production without a `sub` claim. Identity comes from the Customer
  // Account API's customer { id } query below, not from the id_token, so
  // this must succeed exactly like the end-to-end test above.
  const now = Math.floor(Date.now() / 1000);
  const noSubIdToken = await new SignJWT({ nonce: "no-sub-nonce" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
    .setIssuer(ISSUER)
    .setAudience(CLIENT_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(signingKey);

  const supabase = createFakeSupabase();
  const result = await completeCustomerAuthCallback(
    baseDeps({
      transactionCookieValue: validTransactionCookie({ state: "state-no-sub", nonce: "no-sub-nonce", codeVerifier: "verifier-no-sub" }),
      returnedState: "state-no-sub",
      exchangeAuthorizationCode: async () => ({ id_token: noSubIdToken, access_token: "no-sub-flow-access-token" }),
      verifyCustomerIdToken, // the real function, not a fake
      fetchAuthenticatedCustomerId: async ({ accessToken }) => {
        assert.equal(accessToken, "no-sub-flow-access-token");
        return "gid://shopify/Customer/555000888";
      },
      extractNumericCustomerId, // the real function
      getSupabaseClient: async () => supabase
    })
  );

  assert.equal(supabase.tables.learning_users[0].shopify_customer_id, "555000888");

  const exchangeResult = await exchangeCallbackResult(result, supabase);
  assert.equal(exchangeResult.status, 200);
  assert.equal(exchangeResult.body.authenticated, true);
  const verified = verifySessionToken(exchangeResult.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
  assert.equal(verified.payload.shopify_customer_id, "555000888");
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

  assert.notEqual(result.status, 400, "must not be misdiagnosed as a missing OAuth transaction cookie");
  assert.equal(result.status, 302);
  assert.equal(capturedAccessToken, "regression-access-token", "the real access_token from the exchange must reach the Customer Account API call");

  const exchangeResult = await exchangeCallbackResult(result, supabase);
  assert.equal(exchangeResult.status, 200);
  assert.equal(exchangeResult.body.authenticated, true);

  const verified = verifySessionToken(exchangeResult.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
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

  const exchangeA = await exchangeCallbackResult(resultA, supabase);
  const exchangeB = await exchangeCallbackResult(resultB, supabase);

  const verifiedA = verifySessionToken(exchangeA.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
  const verifiedB = verifySessionToken(exchangeB.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
  assert.equal(verifiedA.payload.shopify_customer_id, "111111111");
  assert.equal(verifiedB.payload.shopify_customer_id, "222222222");
  assert.notEqual(verifiedA.payload.shopify_customer_id, verifiedB.payload.shopify_customer_id);
});

test("one customer's handoff code cannot be exchanged to impersonate a different customer's identity", async () => {
  const supabase = createFakeSupabase();
  const resultA = await completeCustomerAuthCallback(
    baseDeps({ getSupabaseClient: async () => supabase, fetchAuthenticatedCustomerId: async () => "gid://shopify/Customer/333000111" })
  );
  const handoffCodeA = extractHandoffCode(resultA.redirectTo);

  // A second, unrelated login for a different customer must not be able to
  // consume the first customer's still-valid, unconsumed handoff code by
  // any means other than presenting that exact code.
  const wrongExchange = await exchangeAuthHandoff({
    handoff: `${handoffCodeA}-tampered`,
    sessionTokenSecret: SESSION_SECRET,
    shopifyShopDomain: SHOP,
    getSupabaseClient: async () => supabase,
    consumeAuthHandoff,
    mintSessionToken
  });
  assert.equal(wrongExchange.status, 400);
  assert.equal(wrongExchange.body.error, "invalid_or_expired_handoff");

  // The real, untampered code still works exactly once.
  const rightExchange = await exchangeCallbackResult(resultA, supabase);
  assert.equal(rightExchange.status, 200);
  const verified = verifySessionToken(rightExchange.body.token, { secret: SESSION_SECRET, expectedShop: SHOP });
  assert.equal(verified.payload.shopify_customer_id, "333000111");
});
