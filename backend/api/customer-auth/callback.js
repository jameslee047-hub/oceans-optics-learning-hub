// GET /api/customer-auth/callback -- completes the Customer Account API
// Authorization Code + PKCE flow started by ./start.js.
//
// On success, this does NOT return the Learning Progress JWT (nor the
// customer ID, nor any Shopify token) directly or in any URL -- it 302s the
// browser back to the storefront return path carried inside the signed
// OAuth transaction, with a one-time opaque handoff code in the URL
// FRAGMENT (#oo_lp_handoff=...), which browsers never send to a server.
// The storefront bootstrap script exchanges that code for the actual
// session token via POST /api/customer-auth/exchange. See
// lib/auth-handoff.js and lib/customer-auth-exchange-service.js.
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
import { getSupabaseClient, findOrCreateLearningUser } from "../../lib/supabase.js";
import { createAuthHandoff } from "../../lib/auth-handoff.js";
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
    createAuthHandoff
  });

  // Diagnostic logging for every failure branch (safe values only: reason
  // strings, HTTP status, Shopify's own OAuth error codes, JSON key names --
  // never a code/token/verifier/cookie/email) already happens inside
  // completeCustomerAuthCallback, co-located with each failure so the log
  // line and the specific check it corresponds to can't drift apart.

  if (result.status === 302) {
    res.setHeader("Location", result.redirectTo);
    res.statusCode = 302;
    res.end();
    return;
  }

  res.status(result.status).json(result.body);
}
