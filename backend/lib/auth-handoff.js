// One-time opaque handoff code bridging the Customer Account OAuth callback
// (a server-to-server redirect -- Shopify strips Set-Cookie from App Proxy
// responses, and the Learning Progress JWT must never appear in a URL) to
// the storefront bootstrap script, which exchanges this code for the
// existing short-lived Learning Progress JWT via
// POST /api/customer-auth/exchange. See migrations/0002_auth_handoffs.sql
// for the backing table and the atomic consume_learning_auth_handoff()
// function this relies on.
//
// The raw code is generated here and returned to the caller (to go only
// into the redirect URL fragment -- never logged), but ONLY its SHA-256
// hash is ever persisted. Losing/leaking the hash does not expose a usable
// credential: SHA-256 cannot be inverted to recover the code, and every row
// is useless after 2 minutes or one consumption, whichever comes first.
import crypto from "node:crypto";

const HANDOFF_TTL_SECONDS = 120;
const RAW_CODE_BYTES = 32;

// crypto.randomBytes(32).toString("base64url") is always 43 base64url
// characters (256 bits, unpadded). The range here is deliberately generous
// so a future change to the byte count doesn't require touching this
// pattern -- this is a basic shape/length sanity check to reject obviously
// malformed input before any database work, not a strict format contract.
const HANDOFF_CODE_FORMAT = /^[A-Za-z0-9_-]{20,128}$/;

function hashCode(rawCode) {
  return crypto.createHash("sha256").update(rawCode, "utf8").digest("hex");
}

export function isValidHandoffCodeFormat(candidate) {
  return typeof candidate === "string" && HANDOFF_CODE_FORMAT.test(candidate);
}

// Generates the one-time code and persists ONLY its hash, associated with
// the given learning_users.id (the pre-existing internal uuid keyed off the
// numeric Shopify customer ID -- never the OIDC sub, never supplied by the
// browser). Returns the raw code.
export async function createAuthHandoff(supabase, userId, { now = Date.now } = {}) {
  const rawCode = crypto.randomBytes(RAW_CODE_BYTES).toString("base64url");
  const codeHash = hashCode(rawCode);
  const expiresAt = new Date(now() + HANDOFF_TTL_SECONDS * 1000).toISOString();

  const { error } = await supabase.from("learning_auth_handoffs").insert({
    code_hash: codeHash,
    user_id: userId,
    expires_at: expiresAt
  });
  if (error) throw error;

  return rawCode;
}

// Atomically consumes a handoff code via the consume_learning_auth_handoff
// Postgres function: matches by hash, requires consumed_at IS NULL and
// expires_at > now(), and marks it consumed, all in a single round trip --
// never a separate select-then-update, which would leave a race window
// where two simultaneous exchanges of the same code could both observe it
// as unused before either write landed.
//
// Returns the associated shopifyCustomerId, or null for ANY invalid
// condition (unknown/expired/already-consumed code) -- deliberately without
// distinguishing which, so a replay attempt learns nothing about why it
// failed.
export async function consumeAuthHandoff(supabase, rawCode) {
  if (!isValidHandoffCodeFormat(rawCode)) return null;

  const codeHash = hashCode(rawCode);
  const { data, error } = await supabase.rpc("consume_learning_auth_handoff", { p_code_hash: codeHash }).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return data.shopify_customer_id;
}
