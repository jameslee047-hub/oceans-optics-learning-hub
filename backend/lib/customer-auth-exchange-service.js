// Core logic for POST /api/customer-auth/exchange, kept separate from
// api/customer-auth/exchange.js (the Vercel route handler) so it's
// unit-testable with plain injected dependencies -- mirrors the
// lib/customer-auth-callback-service.js / lib/progress-service.js pattern.
//
// This is the ONLY place the Learning Progress JWT is minted for the
// Customer Account OAuth flow: the callback (lib/customer-auth-callback-
// service.js) deliberately stops at issuing a one-time opaque handoff code
// instead, since it is a server-to-server redirect target that can't set a
// browser-visible cookie via Set-Cookie (Shopify strips it from App Proxy
// responses) and must never put the session token in a URL.
//
// Never logs the raw handoff code -- only fixed reason strings and safe
// values (mirroring the OAuth callback's diagnostic logging conventions).
export async function exchangeAuthHandoff({
  handoff,
  sessionTokenSecret,
  shopifyShopDomain,
  getSupabaseClient,
  consumeAuthHandoff,
  mintSessionToken
}) {
  if (typeof handoff !== "string" || handoff.length === 0) {
    return { status: 400, body: { error: "invalid_handoff" } };
  }

  let shopifyCustomerId;
  try {
    const supabase = await getSupabaseClient();
    shopifyCustomerId = await consumeAuthHandoff(supabase, handoff);
  } catch (error) {
    console.error("customer-auth/exchange: handoff lookup failed", error.message);
    return { status: 500, body: { error: "handoff_exchange_failed" } };
  }

  // Deliberately the SAME generic error for "unknown", "expired", and
  // "already consumed" -- consumeAuthHandoff already collapses all three
  // into a null return so a replay attempt learns nothing about which
  // condition applied.
  if (!shopifyCustomerId) {
    return { status: 400, body: { error: "invalid_or_expired_handoff" } };
  }

  const token = mintSessionToken({
    shopifyCustomerId,
    shop: shopifyShopDomain,
    secret: sessionTokenSecret
  });

  return { status: 200, body: { authenticated: true, token } };
}
