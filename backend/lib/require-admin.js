// Shared auth guard for the internal /api/admin/* analytics dashboard.
// This protects a small-team internal tool, not a customer-facing surface
// -- HTTP Basic Auth against a single shared credential pair is the
// simplest mechanism that is still genuinely secure here: no session/
// cookie state to manage, no login page to build, and the browser's own
// native prompt handles credential entry and caches it per-origin for
// subsequent fetch() calls to other /api/admin/* routes automatically.
//
// Never hard-coded: both values come ONLY from Vercel environment
// variables (ADMIN_DASHBOARD_USERNAME / ADMIN_DASHBOARD_PASSWORD), set
// server-side and never sent to, or readable by, any browser except as
// whatever the person typed into the native Basic Auth prompt.
//
// A customer's Learning Progress bearer JWT (lib/session-token.js) is
// NEVER accepted here and grants no admin access whatsoever -- this is a
// completely separate credential checked by completely separate code.
import crypto from "node:crypto";

const REALM = "Oceans Optics Learning Analytics";

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");
  // Compare against same-length buffers regardless of the real lengths so
  // a length mismatch can't short-circuit into an early, faster return --
  // crypto.timingSafeEqual itself requires equal-length inputs.
  const paddedA = Buffer.alloc(Math.max(bufA.length, bufB.length));
  const paddedB = Buffer.alloc(Math.max(bufA.length, bufB.length));
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  const lengthsMatch = bufA.length === bufB.length;
  const contentsMatch = crypto.timingSafeEqual(paddedA, paddedB);
  return lengthsMatch && contentsMatch;
}

function sendUnauthorized(res, error) {
  res.setHeader("WWW-Authenticate", `Basic realm="${REALM}"`);
  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error }));
}

// Returns true (request may proceed) or false (a response has already
// been written -- the caller must return immediately without doing any
// further work, especially not touching Supabase).
export function requireAdmin(req, res) {
  const expectedUsername = process.env.ADMIN_DASHBOARD_USERNAME;
  const expectedPassword = process.env.ADMIN_DASHBOARD_PASSWORD;

  // Fail CLOSED: an admin route must never become accidentally public
  // just because an environment variable was left unset in some
  // environment. No default credential exists anywhere in this codebase.
  if (!expectedUsername || !expectedPassword) {
    console.error("requireAdmin: ADMIN_DASHBOARD_USERNAME/ADMIN_DASHBOARD_PASSWORD are not configured");
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "admin_auth_not_configured" }));
    return false;
  }

  const authHeader = req.headers.authorization || "";
  const match = /^Basic (.+)$/.exec(authHeader);
  if (!match) {
    sendUnauthorized(res, "missing_admin_credentials");
    return false;
  }

  let decoded;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch (error) {
    sendUnauthorized(res, "invalid_admin_credentials");
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  const username = separatorIndex === -1 ? decoded : decoded.slice(0, separatorIndex);
  const password = separatorIndex === -1 ? "" : decoded.slice(separatorIndex + 1);

  // Both comparisons always run (never short-circuited) so a mismatched
  // username can't be distinguished, by timing, from a mismatched
  // password.
  const usernameValid = timingSafeEqualStrings(username, expectedUsername);
  const passwordValid = timingSafeEqualStrings(password, expectedPassword);

  if (!usernameValid || !passwordValid) {
    sendUnauthorized(res, "invalid_admin_credentials");
    return false;
  }

  return true;
}
