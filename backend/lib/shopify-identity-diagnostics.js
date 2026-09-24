// Orchestrates an admin-only, read-only health check of Shopify Admin
// customer identity resolution: can we get a token, is `read_customers`
// actually granted (per Shopify's own record, not this repo's config), and
// -- optionally, given a sample numeric customer id -- can we resolve a
// real customer. Never returns a token, secret, or customer PII; see
// routes/admin/identity-diagnostics.js for the route that exposes this
// behind requireAdmin.
import { getShopifyAdminConfig, getShopifyAdminAccessToken, fetchGrantedAdminScopes, fetchShopifyCustomersByIds } from "./shopify-admin-client.js";
import { logIdentityDiagnostic } from "./shopify-identity-log.js";

export async function diagnoseShopifyIdentity({ getConfig = getShopifyAdminConfig, fetchImpl = fetch, sampleCustomerId } = {}) {
  const config = getConfig();
  if (!config.configured) {
    logIdentityDiagnostic("diagnostics: not configured");
    return {
      adminApiAuthenticated: false,
      readCustomersGranted: false,
      scopeCheck: "not_configured",
      customerLookup: "not_attempted"
    };
  }

  let accessToken;
  try {
    accessToken = await getShopifyAdminAccessToken(config, { fetchImpl });
  } catch {
    // getShopifyAdminAccessToken already logged the specific reason.
    return {
      adminApiAuthenticated: false,
      readCustomersGranted: false,
      scopeCheck: "auth_failed",
      customerLookup: "not_attempted"
    };
  }

  let readCustomersGranted = false;
  let scopeCheck = "ok";
  try {
    const scopes = await fetchGrantedAdminScopes({ shopDomain: config.shopDomain, accessToken, apiVersion: config.apiVersion, fetchImpl });
    readCustomersGranted = scopes.includes("read_customers");
  } catch {
    // fetchGrantedAdminScopes already logged the specific reason.
    scopeCheck = "failed";
  }

  let customerLookup = "not_attempted";
  if (typeof sampleCustomerId === "string" && sampleCustomerId.length > 0) {
    try {
      const resolved = await fetchShopifyCustomersByIds({
        shopDomain: config.shopDomain,
        accessToken,
        apiVersion: config.apiVersion,
        numericCustomerIds: [sampleCustomerId],
        fetchImpl
      });
      const info = resolved.get(sampleCustomerId);
      if (!info) customerLookup = "not_found_or_denied";
      else if (info.displayName && info.email) customerLookup = "resolved_full";
      else if (info.displayName || info.email) customerLookup = "resolved_partial";
      else customerLookup = "resolved_empty";
    } catch {
      // fetchShopifyCustomersByIds already logged the specific reason.
      customerLookup = "failed";
    }
  }

  logIdentityDiagnostic("diagnostics complete", { read_customers_granted: readCustomersGranted, scope_check: scopeCheck, customer_lookup: customerLookup });

  return {
    adminApiAuthenticated: true,
    readCustomersGranted,
    scopeCheck,
    customerLookup
  };
}
