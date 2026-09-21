// Cryptographically verifies a Shopify Customer Account API ID token.
// Never merely decode it -- `jose`'s jwtVerify checks the JWS signature
// against the shop's JWKS, plus `exp`/`nbf` and (when passed as options)
// `iss`/`aud`. `nonce` is an OIDC/Shopify-specific check jose has no
// built-in concept of, so it's validated explicitly here.
//
// This ID token is a cryptographic gate only, proving the OAuth flow
// completed correctly and wasn't tampered with -- it is NOT our identity
// source. Our canonical identity is the numeric Shopify customer ID from
// the authenticated `query { customer { id } }` Customer Account API call
// made after this verification succeeds (see
// lib/customer-auth-callback-service.js). `sub` is deliberately not
// required, read, persisted, returned, or logged: some real Shopify
// id_tokens omit it, and we don't need it for anything.
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

  return payload;
}
