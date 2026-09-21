// Serializes/reads the HttpOnly cookie carrying the signed OAuth
// transaction (see oauth-transaction.js) between the start and callback
// endpoints. The browser can send this cookie back, but cannot read or
// modify its contents (HttpOnly) or forge a new one (HMAC-signed).
const COOKIE_NAME = "oo_lp_oauth_txn";
const COOKIE_PATH = "/api/customer-auth";
const MAX_AGE_SECONDS = 10 * 60;

export function serializeOAuthTransactionCookie(token) {
  return `${COOKIE_NAME}=${token}; Max-Age=${MAX_AGE_SECONDS}; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax`;
}

// Sent after the callback consumes (or fails to consume) a transaction, so
// a single authorization attempt can never be replayed against the
// callback twice.
export function clearOAuthTransactionCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax`;
}

export function readOAuthTransactionCookie(req) {
  const header = req.headers?.cookie || "";
  const entry = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!entry) return null;
  return entry.slice(COOKIE_NAME.length + 1);
}
