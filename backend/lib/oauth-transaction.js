// Signs/verifies the short-lived OAuth transaction (state, nonce, PKCE
// code_verifier, and the validated post-login storefront return path) held
// in an HttpOnly cookie between /api/customer-auth/start and
// /api/customer-auth/callback. Signed with SESSION_TOKEN_SECRET (the same
// secret as the Learning Progress session token, per spec) so the browser
// can hold it without being able to forge or read a valid one -- it never
// needs to be readable client-side, only round-tripped.
//
// The return path travels here -- rather than as a callback query
// parameter -- specifically so the callback never has to trust a value an
// attacker could tack onto the callback URL directly: it only ever reads
// the path back out of the transaction it has already cryptographically
// verified (see lib/return-path.js for the validation performed at /start
// before this function is called).
//
// ~10 minute lifetime: long enough for a real login, short enough that a
// stolen/leaked cookie is useless quickly.
import { signPayload, verifyPayloadSignature } from "./signed-token.js";

const TRANSACTION_TTL_SECONDS = 10 * 60;

export function createOAuthTransaction({ state, nonce, codeVerifier, returnPath, secret, now = Date.now }) {
  if (!state || !nonce || !codeVerifier || !returnPath) {
    throw new Error("state, nonce, codeVerifier, and returnPath are all required to create an OAuth transaction");
  }
  return signPayload({ state, nonce, code_verifier: codeVerifier, return_path: returnPath }, secret, TRANSACTION_TTL_SECONDS, now);
}

// Returns { valid: true, state, nonce, codeVerifier, returnPath } or { valid: false, reason }.
export function verifyOAuthTransaction(token, { secret, now = Date.now }) {
  const result = verifyPayloadSignature(token, secret, now);
  if (!result.valid) return result;

  const { state, nonce, code_verifier: codeVerifier, return_path: returnPath } = result.payload;
  if (!state || !nonce || !codeVerifier || !returnPath) {
    return { valid: false, reason: "incomplete_transaction" };
  }

  return { valid: true, state, nonce, codeVerifier, returnPath };
}
