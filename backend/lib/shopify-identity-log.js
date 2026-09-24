// Safe, structured diagnostic logging for Shopify Admin customer identity
// resolution (lib/shopify-admin-client.js, lib/learner-identity.js). This is
// the ONLY sanctioned way those modules write to the console -- funneling
// every call through here makes "what is and isn't safe to log" a single,
// auditable decision instead of one made ad hoc at each call site.
//
// NEVER pass any of the following as a field value: an access token, a
// client secret, an Authorization header, a full request/response object,
// a customer's email/name/address/phone, or a raw GraphQL response body.
// Safe fields are short enum-like category strings, HTTP status codes, and
// counts. A numeric shopify_customer_id is tolerated but avoided by
// preference -- every call site in this codebase logs counts/status
// instead of per-customer detail.
const PREFIX = "[shopify-identity]";

export function logIdentityDiagnostic(message, fields = {}) {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`);
  const suffix = parts.length > 0 ? " " + parts.join(" ") : "";
  console.error(`${PREFIX} ${message}${suffix}`);
}

// Reduces one Shopify GraphQL error item down to only what's safe to log:
// its `extensions.code` (a short Shopify-defined enum like "ACCESS_DENIED"
// or "THROTTLED") and whether it was scoped to a specific field/node (has a
// non-empty `path`) rather than the whole query. Deliberately drops
// `.message` entirely -- it's free-form text from Shopify that could, in
// principle, echo back part of the query/variables, and every category
// this codebase needs is already captured by `code` + `isFieldLevel`.
export function classifyGraphqlError(errorItem) {
  const code = typeof errorItem?.extensions?.code === "string" ? errorItem.extensions.code : null;
  const path = Array.isArray(errorItem?.path) ? errorItem.path : null;
  const isFieldLevel = Boolean(path && path.length > 0);
  return { code, isFieldLevel };
}
