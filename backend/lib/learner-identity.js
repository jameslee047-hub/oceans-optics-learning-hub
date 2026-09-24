// Orchestrates resolving a batch of numeric shopify_customer_id values into
// display names/emails for the internal admin dashboard, via
// lib/shopify-admin-client.js. This module is the enforcement point for two
// rules: (1) a Shopify failure must never break the dashboard -- every
// failure path here is caught and degrades to "unresolved" rather than
// thrown further, and (2) nothing this module returns is ever written back
// to Supabase -- it is only ever attached to an outgoing admin API JSON
// response (see routes/admin/learners.js and routes/admin/learners/[id].js).
import { getShopifyAdminConfig, getShopifyAdminAccessToken, fetchShopifyCustomersByIds, shopifyAdminCustomerUrl } from "./shopify-admin-client.js";

// Keeps each individual Admin GraphQL request small and bounds the blast
// radius of one failed/rate-limited batch -- well under Shopify's own
// nodes() limit of 250 ids per call.
const BATCH_SIZE = 50;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Returns a Map<numericCustomerId, { displayName, email }> containing only
// the customers that were successfully resolved. Never throws: if lookup
// isn't configured, if auth fails, or if a batch request fails/is rate
// limited, the affected customers are simply absent from the returned map
// -- callers fall back to the numeric ID for those (see
// buildLearnerIdentity below).
export async function resolveShopifyIdentities(numericCustomerIds, { getConfig = getShopifyAdminConfig, fetchImpl = fetch } = {}) {
  const uniqueIds = Array.from(new Set((numericCustomerIds || []).filter((id) => typeof id === "string" && id.length > 0)));
  const result = new Map();
  if (uniqueIds.length === 0) return result;

  const config = getConfig();
  if (!config.configured) return result;

  let accessToken;
  try {
    accessToken = await getShopifyAdminAccessToken(config, { fetchImpl });
  } catch (error) {
    console.error("learner-identity: Shopify admin auth failed, falling back to customer IDs only", error.message);
    return result;
  }

  const batches = chunk(uniqueIds, BATCH_SIZE);
  await Promise.all(
    batches.map(async (batchIds) => {
      try {
        const batchResult = await fetchShopifyCustomersByIds({
          shopDomain: config.shopDomain,
          accessToken,
          apiVersion: config.apiVersion,
          numericCustomerIds: batchIds,
          fetchImpl
        });
        batchResult.forEach((value, key) => result.set(key, value));
      } catch (error) {
        // Covers a network error, a non-2xx (including 429 rate-limiting),
        // and a scope-denied/other GraphQL error alike -- this batch's
        // customers simply remain unresolved; other batches are unaffected.
        console.error("learner-identity: Shopify admin customer batch lookup failed, falling back for this batch", error.message);
      }
    })
  );

  return result;
}

// Builds the identity fields the dashboard displays for one learner, given
// a Map already produced by resolveShopifyIdentities. Always returns a
// usable fallback_label ("Customer #<id>") so the UI never has to special-
// case an unresolved customer.
export function buildLearnerIdentity(shopifyCustomerId, resolved, shopDomain) {
  const info = resolved.get(String(shopifyCustomerId));
  return {
    display_name: info?.displayName || null,
    email: info?.email || null,
    shopify_admin_url: shopifyAdminCustomerUrl(shopDomain, shopifyCustomerId),
    fallback_label: `Customer #${shopifyCustomerId}`
  };
}
