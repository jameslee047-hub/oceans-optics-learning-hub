// Cryptographically verifies a Shopify Customer Account API ID token.
// Never merely decode it -- `jose`'s jwtVerify checks the JWS signature
// against the shop's JWKS, plus `exp`/`nbf` and (when passed as options)
// `iss`/`aud`. `nonce` and `sub` are OIDC/Shopify-specific checks jose has
// no built-in concept of, so they're validated explicitly here.
//
// `jwks` is a jose key resolver: `createRemoteJWKSet(new URL(jwks_uri))` in
// production, `createLocalJWKSet(jwksJson)` in tests -- injected so tests
// never touch the network.
import { jwtVerify } from "jose";

export async function verifyCustomerIdToken(idToken, { jwks, issuer, audience, expectedNonce }) {
  const { payload } = await jwtVerify(idToken, jwks, { issuer, audience });

  if (payload.nonce !== expectedNonce) {
    throw new Error("id_token_nonce_mismatch");
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("id_token_missing_sub");
  }

  return payload;
}
