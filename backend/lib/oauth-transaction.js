// Signs/verifies the short-lived OAuth transaction (state, nonce, PKCE
// code_verifier) held in an HttpOnly cookie between /api/customer-auth/start
// and /api/customer-auth/callback. Signed with SESSION_TOKEN_SECRET (the
// same secret as the Learning Progress session token, per spec) so the
// browser can hold it without being able to forge or read a valid one --
// it never needs to be readable client-side, only round-tripped.
//
// ~10 minute lifetime: long enough for a real login, short enough that a
// stolen/leaked cookie is useless quickly.
import { signPayload, verifyPayloadSignature } from "./signed-token.js";

const TRANSACTION_TTL_SECONDS = 10 * 60;

export function createOAuthTransaction({ state, nonce, codeVerifier, secret, now = Date.now }) {
  if (!state || !nonce || !codeVerifier) {
    throw new Error("state, nonce, and codeVerifier are all required to create an OAuth transaction");
  }
  return signPayload({ state, nonce, code_verifier: codeVerifier }, secret, TRANSACTION_TTL_SECONDS, now);
}

// Returns { valid: true, state, nonce, codeVerifier } or { valid: false, reason }.
export function verifyOAuthTransaction(token, { secret, now = Date.now }) {
  const result = verifyPayloadSignature(token, secret, now);
  if (!result.valid) return result;

  const { state, nonce, code_verifier: codeVerifier } = result.payload;
  if (!state || !nonce || !codeVerifier) {
    return { valid: false, reason: "incomplete_transaction" };
  }

  return { valid: true, state, nonce, codeVerifier };
}
