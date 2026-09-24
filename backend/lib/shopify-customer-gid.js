// Validates and extracts the numeric ID from a Shopify GraphQL Customer
// global ID (gid://shopify/Customer/{numeric_id}). This is the ONLY
// accepted source of a numeric shopify_customer_id in the OAuth flow --
// never trust a customer ID supplied directly by browser JS, and never
// accept a GID that isn't exactly this shape (e.g. a different resource
// type, or a non-numeric/empty suffix).
const CUSTOMER_GID_PATTERN = /^gid:\/\/shopify\/Customer\/([0-9]+)$/;

// Returns the numeric ID as a string (safe for a bigint column and for
// JSON round-tripping without floating-point precision loss). Throws if
// `gid` is not exactly `gid://shopify/Customer/<digits>` -- including a
// GID for a different resource type, extra path segments, or a
// non-numeric/empty suffix.
export function extractNumericCustomerId(gid) {
  if (typeof gid !== "string") {
    throw new Error("invalid_customer_gid: not a string");
  }

  const match = CUSTOMER_GID_PATTERN.exec(gid);
  if (!match) {
    throw new Error("invalid_customer_gid: does not match gid://shopify/Customer/{numeric_id}");
  }

  return match[1];
}

// The inverse of extractNumericCustomerId -- builds the Admin GraphQL
// global ID for a numeric shopify_customer_id (e.g. "7662557626701" ->
// "gid://shopify/Customer/7662557626701"), used by
// lib/shopify-admin-client.js's nodes(ids:...) lookup. Throws for anything
// that isn't a non-empty numeric-digit string, so a malformed id can never
// silently produce a malformed GID sent to Shopify.
const NUMERIC_ID_PATTERN = /^[0-9]+$/;

export function buildCustomerGid(numericCustomerId) {
  const value = typeof numericCustomerId === "number" ? String(numericCustomerId) : numericCustomerId;
  if (typeof value !== "string" || !NUMERIC_ID_PATTERN.test(value)) {
    throw new Error("invalid_numeric_customer_id: expected a non-empty digit string");
  }
  return `gid://shopify/Customer/${value}`;
}
