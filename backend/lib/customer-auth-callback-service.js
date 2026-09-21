// Core OAuth callback logic, kept separate from api/customer-auth/callback.js
// (the Vercel route handler) so it's unit-testable with plain injected
// dependencies -- no real network, no real Supabase, no module mocking.
// Mirrors the existing lib/progress-service.js pattern: this file returns a
// plain { status, body } result; the route handler is only responsible for
// parsing the request and writing that result to a real HTTP response.
//
// Flow: OAuth code exchange -> verify ID token (cryptographic gate only;
// its `sub` is never persisted) -> discover the Customer Account API ->
// query customer { id } using the access_token -> validate the returned
// GID and extract the numeric Shopify customer ID -> find-or-create
// learning_users by that numeric ID -> mint our Learning Progress JWT.
//
// Diagnostic logging throughout this file is deliberately restricted to
// safe values only: fixed reason strings, HTTP status codes, Shopify's own
// OAuth error codes/descriptions, and JSON key NAMES. Never log/print a
// code, verifier, cookie value, access_token, id_token, or email.
import crypto from "node:crypto";
import { verifyOAuthTransaction } from "./oauth-transaction.js";

function constantTimeStringEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function completeCustomerAuthCallback({
  code,
  returnedState,
  transactionCookieValue,
  sessionTokenSecret,
  shopStorefrontDomain,
  shopifyClientId,
  shopifyShopDomain,
  redirectUri,
  discoverOidcConfiguration,
  exchangeAuthorizationCode,
  createJwks,
  verifyCustomerIdToken,
  discoverCustomerAccountApi,
  fetchAuthenticatedCustomerId,
  extractNumericCustomerId,
  getSupabaseClient,
  findOrCreateLearningUser,
  mintSessionToken
}) {
  if (!code || !returnedState) {
    return { status: 400, body: { error: "missing_code_or_state" } };
  }

  const transaction = verifyOAuthTransaction(transactionCookieValue, { secret: sessionTokenSecret });
  if (!transaction.valid) {
    // `cookiePresent: false` here means the browser sent no
    // oo_lp_oauth_txn cookie at all on this request -- typically because
    // /start's Set-Cookie was scoped to a different host than the one
    // Shopify redirected back to (e.g. a Vercel preview deployment URL
    // instead of the exact registered redirect_uri host), or because the
    // browser dropped it for some other reason. `cookiePresent: true` with
    // a reason like "expired"/"invalid_signature" points to a different,
    // more specific problem instead.
    console.error("customer-auth/callback: OAuth transaction invalid", {
      reason: transaction.reason,
      cookiePresent: Boolean(transactionCookieValue)
    });

    // verifyOAuthTransaction's "missing_token" is lib/signed-token.js's
    // generic "no token string at all" reason -- shared with
    // verifySessionToken's unrelated bearer-token check. Surfacing that
    // exact word here reads as if Shopify's OAuth token were missing (it
    // isn't reached yet at this point in the flow), which is exactly the
    // ambiguity that caused this to be misread during the live incident.
    // Only THIS callback path remaps it to something unambiguous; the
    // shared primitive and its other caller are untouched.
    const errorCode = transaction.reason === "missing_token" ? "missing_oauth_transaction_cookie" : transaction.reason;
    return { status: 400, body: { error: errorCode } };
  }

  if (!constantTimeStringEqual(returnedState, transaction.state)) {
    console.error("customer-auth/callback: state mismatch");
    return { status: 400, body: { error: "state_mismatch" } };
  }

  let discovery;
  try {
    discovery = await discoverOidcConfiguration(shopStorefrontDomain);
  } catch (error) {
    console.error("customer-auth/callback: OIDC discovery failed", error.message);
    return { status: 502, body: { error: "discovery_failed" } };
  }

  let tokenResponse;
  try {
    tokenResponse = await exchangeAuthorizationCode({
      tokenEndpoint: discovery.token_endpoint,
      clientId: shopifyClientId,
      redirectUri,
      code,
      codeVerifier: transaction.codeVerifier
    });
  } catch (error) {
    // error.message here is already restricted to safe content -- HTTP
    // status, Shopify's own OAuth error code/description, or JSON key
    // names -- see lib/customer-account-token-exchange.js.
    console.error("customer-auth/callback: token exchange failed", error.message);
    return { status: 502, body: { error: "token_exchange_failed" } };
  }

  // Cryptographic gate only: proves the OAuth flow completed correctly and
  // wasn't tampered with (signature/issuer/audience/expiry/nonce/sub-
  // presence). The verified payload's `sub` is deliberately never read
  // past this point -- our persisted identity comes from the Customer
  // Account API query below, not the ID token.
  try {
    const jwks = createJwks(discovery.jwks_uri);
    await verifyCustomerIdToken(tokenResponse.id_token, {
      jwks,
      issuer: discovery.issuer,
      audience: shopifyClientId,
      expectedNonce: transaction.nonce
    });
  } catch (error) {
    console.error("customer-auth/callback: id_token verification failed", error.message);
    return { status: 401, body: { error: "invalid_id_token" } };
  }

  let customerAccountApi;
  try {
    customerAccountApi = await discoverCustomerAccountApi(shopStorefrontDomain);
  } catch (error) {
    console.error("customer-auth/callback: Customer Account API discovery failed", error.message);
    return { status: 502, body: { error: "customer_account_api_discovery_failed" } };
  }

  let customerGid;
  try {
    customerGid = await fetchAuthenticatedCustomerId({
      graphqlEndpoint: customerAccountApi.graphql_api,
      accessToken: tokenResponse.access_token
    });
  } catch (error) {
    console.error("customer-auth/callback: customer { id } query failed", error.message);
    return { status: 502, body: { error: "customer_account_api_query_failed" } };
  }

  let shopifyCustomerId;
  try {
    shopifyCustomerId = extractNumericCustomerId(customerGid);
  } catch (error) {
    console.error("customer-auth/callback: invalid customer GID shape");
    return { status: 401, body: { error: "invalid_customer_gid" } };
  }

  try {
    const supabase = await getSupabaseClient();
    await findOrCreateLearningUser(supabase, shopifyCustomerId);

    const token = mintSessionToken({
      shopifyCustomerId,
      shop: shopifyShopDomain,
      secret: sessionTokenSecret
    });

    return { status: 200, body: { authenticated: true, customerId: shopifyCustomerId, token } };
  } catch (error) {
    console.error("customer-auth/callback: post-auth user lookup/token mint failed", error.message);
    return { status: 500, body: { error: "identity_finalization_failed" } };
  }
}
