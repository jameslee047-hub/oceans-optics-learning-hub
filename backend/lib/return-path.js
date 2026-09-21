// Validates the post-login storefront return path for the Customer Account
// OAuth handoff, closing off open-redirect vectors. The validated result is
// stored INSIDE the signed OAuth transaction (see oauth-transaction.js) at
// /start -- the callback must never trust a return_to value supplied
// directly on the callback request itself, only the one baked into the
// transaction it already cryptographically verified.
export const DEFAULT_RETURN_PATH = "/pages/learn";
export const STOREFRONT_ORIGIN = "https://oceansoptics.com";

// Accepts only a same-origin relative path. Rejects (defaults instead of
// erroring, so a bad/missing return_to never fails the whole login) any
// absolute URL, protocol-relative "//host" URL, "javascript:" URI, literal
// backslash (which WHATWG URL parsing treats as a path/host separator for
// special schemes like https, same as "/" -- "/\\evil.example" resolves
// like "//evil.example"), or any other encoded/whitespace trick that would
// resolve to a different origin. The authoritative check is the final
// `resolved.origin` comparison, using the same URL parser real browsers
// use to resolve relative references -- not string pattern-matching, which
// is easy to bypass with a trick nobody thought to block.
export function sanitizeReturnPath(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) return DEFAULT_RETURN_PATH;
  if (candidate.includes("\\")) return DEFAULT_RETURN_PATH;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return DEFAULT_RETURN_PATH;

  let resolved;
  try {
    resolved = new URL(candidate, STOREFRONT_ORIGIN);
  } catch (error) {
    return DEFAULT_RETURN_PATH;
  }
  if (resolved.origin !== STOREFRONT_ORIGIN) return DEFAULT_RETURN_PATH;

  // Fragment is deliberately dropped: the callback appends its own
  // #oo_lp_handoff=<code> fragment, and a URL can only carry one.
  return resolved.pathname + resolved.search;
}

// The callback constructs the final redirect using ONLY this fixed origin
// -- never a return_to-supplied origin -- so a validated path can never be
// combined with an attacker-chosen host.
export function buildReturnUrl(returnPath) {
  return `${STOREFRONT_ORIGIN}${returnPath}`;
}
