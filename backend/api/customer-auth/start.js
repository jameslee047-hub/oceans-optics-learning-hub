// GET /api/customer-auth/start -- begins the Shopify Customer Account API
// Authorization Code + PKCE flow. This is a PUBLIC OAuth client (see
// [customer_authentication] in shopify-app/shopify.app.toml): only
// SHOPIFY_CLIENT_ID is used here, never SHOPIFY_API_SECRET.
//
// Authorization/token/JWKS endpoints are never hardcoded -- discovered
// fresh from the shop's OIDC configuration document every time.
import { discoverOidcConfiguration } from "../../lib/shopify-discovery.js";
import { generateRandomToken, generatePkceVerifier, computePkceChallenge } from "../../lib/pkce.js";
import { createOAuthTransaction } from "../../lib/oauth-transaction.js";
import { serializeOAuthTransactionCookie } from "../../lib/oauth-cookie.js";

export const REDIRECT_URI = "https://oceans-optics-learning-progress.vercel.app/api/customer-auth/callback";
export const SCOPE = "openid email customer-account-api:full";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  let discovery;
  try {
    discovery = await discoverOidcConfiguration(process.env.SHOP_STOREFRONT_DOMAIN);
  } catch (error) {
    console.error("customer-auth/start: OIDC discovery failed", error.message);
    res.status(502).json({ error: "discovery_failed" });
    return;
  }

  const state = generateRandomToken();
  const nonce = generateRandomToken();
  const codeVerifier = generatePkceVerifier();
  const codeChallenge = computePkceChallenge(codeVerifier);

  const transaction = createOAuthTransaction({
    state,
    nonce,
    codeVerifier,
    secret: process.env.SESSION_TOKEN_SECRET
  });

  const authorizationUrl = new URL(discovery.authorization_endpoint);
  authorizationUrl.searchParams.set("client_id", process.env.SHOPIFY_CLIENT_ID);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizationUrl.searchParams.set("scope", SCOPE);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", nonce);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  res.setHeader("Set-Cookie", serializeOAuthTransactionCookie(transaction));
  res.writeHead(302, { Location: authorizationUrl.toString() });
  res.end();
}
