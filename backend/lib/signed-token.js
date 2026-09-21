// Generic HS256, JWT-shaped signed/expiring token primitive -- no
// domain-specific fields or validation. Shared by session-token.js (the
// public-facing Learning Progress bearer token) and oauth-transaction.js
// (the internal, cookie-only OAuth state/nonce/PKCE-verifier holder). Keep
// domain-specific claim validation (which fields must be present, shop
// matching, etc.) in the caller, not here.
import crypto from "node:crypto";

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

export function signPayload(payload, secret, ttlSeconds, now = Date.now) {
  if (!secret) throw new Error("secret is required to sign a token");

  const iat = Math.floor(now() / 1000);
  const exp = iat + ttlSeconds;

  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload = { ...payload, iat, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", secret).update(signingInput).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

// Verifies signature + expiration only. Returns { valid: true, payload } or
// { valid: false, reason }. Callers must additionally check that whatever
// domain-specific fields they need are actually present in `payload`.
export function verifyPayloadSignature(token, secret, now = Date.now) {
  if (!token || typeof token !== "string") return { valid: false, reason: "missing_token" };
  if (!secret) throw new Error("secret is required to verify a token");

  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, reason: "malformed_token" };
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(signingInput).digest();

  let providedSignature;
  try {
    providedSignature = base64UrlDecode(encodedSignature);
  } catch (error) {
    return { valid: false, reason: "malformed_token" };
  }

  const signatureValid =
    providedSignature.length === expectedSignature.length &&
    crypto.timingSafeEqual(providedSignature, expectedSignature);
  if (!signatureValid) return { valid: false, reason: "invalid_signature" };

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));
  } catch (error) {
    return { valid: false, reason: "invalid_payload" };
  }

  const nowSeconds = Math.floor(now() / 1000);
  if (typeof payload.exp !== "number" || nowSeconds >= payload.exp) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, payload };
}
