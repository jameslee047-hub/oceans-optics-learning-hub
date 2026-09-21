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
    return { status: 400, body: { error: transaction.reason } };
  }

  if (!constantTimeStringEqual(returnedState, transaction.state)) {
    return { status: 400, body: { error: "state_mismatch" } };
  }

  let discovery;
  try {
    discovery = await discoverOidcConfiguration(shopStorefrontDomain);
  } catch (error) {
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
    return { status: 401, body: { error: "invalid_id_token" } };
  }

  let customerAccountApi;
  try {
    customerAccountApi = await discoverCustomerAccountApi(shopStorefrontDomain);
  } catch (error) {
    return { status: 502, body: { error: "customer_account_api_discovery_failed" } };
  }

  let customerGid;
  try {
    customerGid = await fetchAuthenticatedCustomerId({
      graphqlEndpoint: customerAccountApi.graphql_api,
      accessToken: tokenResponse.access_token
    });
  } catch (error) {
    return { status: 502, body: { error: "customer_account_api_query_failed" } };
  }

  let shopifyCustomerId;
  try {
    shopifyCustomerId = extractNumericCustomerId(customerGid);
  } catch (error) {
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
    return { status: 500, body: { error: "identity_finalization_failed" } };
  }
}
