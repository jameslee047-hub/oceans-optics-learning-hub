// GET /api/customer-auth/callback -- completes the Customer Account API
// Authorization Code + PKCE flow started by ./start.js.
//
// TEMPORARY diagnostic response for this Phase A.2 proof: returns
// { authenticated, customerId, token } directly instead of redirecting back
// into the storefront with the token. The storefront hand-off/UI comes in
// the next phase, once this identity flow has been proven end-to-end on
// the real store. Never returns access_token, id_token, the OIDC sub, or
// any email claim.
//
// This file is a thin adapter: it parses the request and writes the
// response, but all the actual OAuth/verification/lookup logic lives in
// lib/customer-auth-callback-service.js so it's unit-testable with plain
// injected dependencies (see test/customer-auth-callback.test.js) -- no
// real network, real Supabase, or module mocking required.
import { createRemoteJWKSet } from "jose";
import { discoverOidcConfiguration } from "../../lib/shopify-discovery.js";
import { exchangeAuthorizationCode } from "../../lib/customer-account-token-exchange.js";
import { verifyCustomerIdToken } from "../../lib/customer-account-jwt.js";
import { discoverCustomerAccountApi } from "../../lib/customer-account-api-discovery.js";
import { fetchAuthenticatedCustomerId } from "../../lib/customer-account-graphql.js";
import { extractNumericCustomerId } from "../../lib/shopify-customer-gid.js";
import { mintSessionToken } from "../../lib/session-token.js";
import { getSupabaseClient, findOrCreateLearningUser } from "../../lib/supabase.js";
import { readOAuthTransactionCookie, clearOAuthTransactionCookie } from "../../lib/oauth-cookie.js";
import { completeCustomerAuthCallback } from "../../lib/customer-auth-callback-service.js";

export const REDIRECT_URI = "https://oceans-optics-learning-progress.vercel.app/api/customer-auth/callback";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const { code, state: returnedState } = req.query || {};
  const transactionCookieValue = readOAuthTransactionCookie(req);

  // The transaction cookie is single-use regardless of outcome: clear it
  // now so a failed or already-consumed attempt can never be replayed
  // against this callback again.
  res.setHeader("Set-Cookie", clearOAuthTransactionCookie());

  const result = await completeCustomerAuthCallback({
    code,
    returnedState,
    transactionCookieValue,
    sessionTokenSecret: process.env.SESSION_TOKEN_SECRET,
    shopStorefrontDomain: process.env.SHOP_STOREFRONT_DOMAIN,
    shopifyClientId: process.env.SHOPIFY_CLIENT_ID,
    shopifyShopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    redirectUri: REDIRECT_URI,
    discoverOidcConfiguration,
    exchangeAuthorizationCode,
    createJwks: (jwksUri) => createRemoteJWKSet(new URL(jwksUri)),
    verifyCustomerIdToken,
    discoverCustomerAccountApi,
    fetchAuthenticatedCustomerId,
    extractNumericCustomerId,
    getSupabaseClient,
    findOrCreateLearningUser,
    mintSessionToken
  });

  // Diagnostic logging for every failure branch (safe values only: reason
  // strings, HTTP status, Shopify's own OAuth error codes, JSON key names --
  // never a code/token/verifier/cookie/email) already happens inside
  // completeCustomerAuthCallback, co-located with each failure so the log
  // line and the specific check it corresponds to can't drift apart.

  res.status(result.status).json(result.body);
}
