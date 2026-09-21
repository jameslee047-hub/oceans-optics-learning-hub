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

// Returns the raw Cookie header as a string, regardless of which request
// shape Vercel hands us. Node's http.IncomingMessage exposes headers as a
// plain object (req.headers.cookie); a Fetch-API-style Request exposes them
// as a Headers instance (req.headers.get("cookie")) with no .cookie
// property at all. A platform/proxy that (unusually) forwards more than one
// Cookie header can surface it as an array instead of a pre-joined string.
// We must not assume any single one of these shapes.
function getRawCookieHeader(req) {
  const headers = req?.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") {
    return headers.get("cookie") || headers.get("Cookie") || "";
  }
  const value = headers.cookie ?? headers.Cookie;
  if (Array.isArray(value)) return value.join("; ");
  return typeof value === "string" ? value : "";
}

// Splits a raw Cookie header into { name, value } pairs. Matches by exact
// name (via the first "=" in each segment), not by prefix, so a cookie
// whose name merely starts with COOKIE_NAME can never be mistaken for it.
function parseCookieHeader(header) {
  if (!header) return [];
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return { name: part, value: "" };
      return { name: part.slice(0, separatorIndex).trim(), value: part.slice(separatorIndex + 1).trim() };
    });
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

// Deliberately does NOT read req.cookies (a framework/platform convenience
// that may or may not exist depending on runtime, and that we cannot verify
// was parsed from the same raw header). Always re-parses the raw Cookie
// header ourselves, so the value we act on is one we can account for.
export function readOAuthTransactionCookie(req) {
  const header = getRawCookieHeader(req);
  const pairs = parseCookieHeader(header);
  const match = pairs.find((pair) => pair.name === COOKIE_NAME);

  if (!match) {
    // Safe diagnostics only: presence flags and cookie NAMES, never values.
    console.error("oauth-cookie: transaction cookie not found in request", {
      cookieHeaderPresent: header.length > 0,
      cookieNames: pairs.map((pair) => pair.name),
      oauthTransactionCookieFound: false
    });
    return null;
  }

  return safeDecode(match.value);
}
