// PKCE (RFC 7636) helpers for the Customer Account API Authorization Code +
// PKCE flow. All randomness comes from node:crypto's CSPRNG.
import crypto from "node:crypto";

function base64UrlEncode(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Used for `state`, `nonce`, and the PKCE `code_verifier`. 32 random bytes
// base64url-encodes to 43 characters -- within RFC 7636's required 43-128
// range for a code_verifier, and comfortably unguessable for state/nonce.
export function generateRandomToken(byteLength = 32) {
  return base64UrlEncode(crypto.randomBytes(byteLength));
}

export function generatePkceVerifier() {
  return generateRandomToken(32);
}

// code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier))), no padding.
export function computePkceChallenge(codeVerifier) {
  const hash = crypto.createHash("sha256").update(codeVerifier, "ascii").digest();
  return base64UrlEncode(hash);
}
