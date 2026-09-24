// Server-only Shopify Admin API client for resolving a numeric
// shopify_customer_id into a display name/email for the internal admin
// dashboard only. Never imported by any customer-facing route.
//
// AUTH: mirrors shopify/scripts/shopify-admin-client.js's dual-mode design
// (a completely separate, local-only content-management credential -- see
// the project report). Two modes, preferred in this order:
//   1. client_credentials -- reuses this app's own SHOPIFY_CLIENT_ID +
//      SHOPIFY_API_SECRET (already required in this deployment for App
//      Proxy signature verification and webhook HMAC verification -- see
//      .env.example) to mint a short-lived Admin API access token via
//      Shopify's OAuth client_credentials grant. No new secret needed IF
//      this app's granted Admin scopes already include `read_customers`.
//   2. legacy_admin_access_token -- a static token via
//      SHOPIFY_ADMIN_API_ACCESS_TOKEN, for a separate legacy custom-app
//      credential, if that is preferred instead.
//
// As of this writing, this app's Admin scopes are `write_app_proxy` only
// (see shopify-app/shopify.app.toml) -- `read_customers` is NOT granted.
// Every customer lookup below will therefore fail with a scope-denied
// GraphQL error until that scope is added AND the store re-approves the
// expanded grant (shopify.dev/docs/api/usage/access-scopes) -- a
// deliberate reauthorization step this module never performs itself. Every
// caller in this codebase treats that failure as a soft, per-batch
// fallback (see lib/learner-identity.js), never a hard error.
import { extractNumericCustomerId, buildCustomerGid } from "./shopify-customer-gid.js";
import { logIdentityDiagnostic, classifyGraphqlError } from "./shopify-identity-log.js";

const DEFAULT_API_VERSION = "2026-07";

export function getShopifyAdminConfig(env = process.env) {
  const shopDomain = env.SHOPIFY_SHOP_DOMAIN || "";
  const clientId = env.SHOPIFY_CLIENT_ID || "";
  const clientSecret = env.SHOPIFY_API_SECRET || "";
  const staticAccessToken = env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || "";
  const apiVersion = env.SHOPIFY_ADMIN_API_VERSION || DEFAULT_API_VERSION;

  const authMode = clientId && clientSecret ? "client_credentials" : staticAccessToken ? "legacy_admin_access_token" : "missing";

  return {
    shopDomain,
    clientId,
    clientSecret,
    staticAccessToken,
    apiVersion,
    authMode,
    configured: Boolean(shopDomain) && authMode !== "missing"
  };
}

// Fetches one Admin API access token for this request. Not cached across
// requests -- this is an internal, low-traffic staff tool (one dashboard
// load resolves at most a few dozen learners in a couple of batches), so a
// fresh token per admin request is simpler and avoids any cross-invocation
// stale-token/serverless-cold-start caching complexity, at the cost of one
// extra token request per dashboard load versus per-token-lifetime.
export async function getShopifyAdminAccessToken(config, { fetchImpl = fetch } = {}) {
  if (config.authMode === "legacy_admin_access_token") {
    logIdentityDiagnostic("admin token acquired", { auth_mode: config.authMode });
    return config.staticAccessToken;
  }
  if (config.authMode !== "client_credentials") {
    logIdentityDiagnostic("token acquisition failed", { error_type: "not_configured" });
    throw new Error("shopify_admin_not_configured");
  }

  let response;
  try {
    response = await fetchImpl(`https://${config.shopDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret
      }).toString()
    });
  } catch (error) {
    // error.message from a fetch network failure (DNS/TLS/connection reset)
    // is safe -- it never contains the client_secret, which is sent only as
    // an outgoing POST body field, never echoed into a thrown JS Error.
    logIdentityDiagnostic("token acquisition failed", { shop_domain: config.shopDomain, error_type: "network_error" });
    throw new Error(`shopify_admin_token_network_error: ${error.message}`);
  }

  if (!response.ok) {
    // Deliberately never reads/logs the response body here -- a failed
    // client_credentials grant can echo back request parameters (Shopify's
    // OAuth error responses sometimes include `error_description`), so the
    // body is treated as potentially unsafe and is never read at all.
    logIdentityDiagnostic("token acquisition failed", {
      http_status: response.status,
      shop_domain: config.shopDomain,
      error_type: "http_error"
    });
    throw new Error(`shopify_admin_token_http_${response.status}`);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    logIdentityDiagnostic("token acquisition failed", { shop_domain: config.shopDomain, error_type: "invalid_json" });
    throw new Error("shopify_admin_token_invalid_json");
  }

  if (typeof body.access_token !== "string" || !body.access_token) {
    logIdentityDiagnostic("token acquisition failed", { shop_domain: config.shopDomain, error_type: "missing_access_token" });
    throw new Error("shopify_admin_token_missing");
  }
  logIdentityDiagnostic("admin token acquired", { auth_mode: config.authMode });
  return body.access_token;
}

// Minimal, read-only query -- exactly the three fields the admin dashboard
// needs (id to map the result back, displayName, email). Never widen this
// to request orders, addresses, phone, tags, or any other customer field
// without a documented, separately-approved reason.
const CUSTOMERS_BY_ID_QUERY = `
  query LearnerIdentityLookup($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Customer {
        id
        displayName
        email
      }
    }
  }
`;

// Shopify's nodes() query accepts up to 250 ids in one call; bounded lower
// here (see lib/learner-identity.js's BATCH_SIZE) mainly to keep each
// individual GraphQL response small and each failure's blast radius small,
// not because of the API's own limit.
export async function fetchShopifyCustomersByIds({ shopDomain, accessToken, apiVersion = DEFAULT_API_VERSION, numericCustomerIds, fetchImpl = fetch }) {
  const ids = (numericCustomerIds || []).map((id) => buildCustomerGid(id));
  if (ids.length === 0) return new Map();

  const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query: CUSTOMERS_BY_ID_QUERY, variables: { ids } })
    });
  } catch (error) {
    logIdentityDiagnostic("customer lookup failed", { reason: "network_error" });
    throw new Error(`shopify_admin_customers_network_error: ${error.message}`);
  }

  if (!response.ok) {
    const reason = response.status === 401 || response.status === 403 ? "http_auth_failed" : response.status === 429 ? "rate_limited" : "http_error";
    logIdentityDiagnostic("customer lookup failed", { reason, http_status: response.status });
    throw new Error(`shopify_admin_customers_http_${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    logIdentityDiagnostic("customer lookup failed", { reason: "invalid_json", http_status: response.status });
    throw new Error("shopify_admin_customers_invalid_json");
  }

  const rawErrors = Array.isArray(payload.errors) ? payload.errors : [];
  const classifiedErrors = rawErrors.map(classifyGraphqlError);
  // A field-level error (has a `path`) means SOME field on a node was
  // redacted/denied -- e.g. Shopify's Protected Customer Data feature can
  // return the Customer node with displayName/email nulled out rather than
  // failing the whole query. That's still partially useful (a resolved
  // displayName even with email redacted beats no name at all), so it must
  // NOT discard payload.data -- only a query-wide error (no path, or no
  // usable data at all) is treated as a hard failure for this batch.
  const hasQueryWideError = classifiedErrors.some((e) => !e.isFieldLevel);
  const nodesAvailable = Array.isArray(payload.data?.nodes);

  if (hasQueryWideError || (!nodesAvailable && classifiedErrors.length > 0)) {
    const accessDenied = classifiedErrors.some((e) => e.code === "ACCESS_DENIED");
    const throttled = classifiedErrors.some((e) => e.code === "THROTTLED");
    const reason = accessDenied ? "access_denied" : throttled ? "throttled" : "graphql_error";
    logIdentityDiagnostic("customer lookup failed", { reason, http_status: response.status, error_count: rawErrors.length });
    throw new Error(`shopify_admin_customers_graphql_error: ${reason}`);
  }

  if (classifiedErrors.length > 0) {
    logIdentityDiagnostic("customer node resolved but protected fields unavailable", { affected_count: classifiedErrors.length });
  }

  const result = new Map();
  let nullNodeCount = 0;
  let resolvedCount = 0;
  let emptyFieldCount = 0;
  const nodes = nodesAvailable ? payload.data.nodes : [];
  nodes.forEach((node) => {
    if (!node) {
      nullNodeCount += 1;
      return;
    }
    let numericId;
    try {
      numericId = extractNumericCustomerId(node.id);
    } catch {
      return;
    }
    const displayName = typeof node.displayName === "string" && node.displayName ? node.displayName : null;
    const email = typeof node.email === "string" && node.email ? node.email : null;
    if (displayName || email) resolvedCount += 1;
    else emptyFieldCount += 1;
    result.set(numericId, { displayName, email });
  });

  if (nullNodeCount > 0) {
    logIdentityDiagnostic("customer node returned null", { count: nullNodeCount });
  }
  if (emptyFieldCount > 0) {
    // The node itself is accessible (it came back non-null with a valid
    // Customer id), but neither displayName nor email was usable -- either
    // genuinely empty on the customer record, or silently redacted by
    // Shopify's Protected Customer Data feature without a matching
    // GraphQL error entry. Cannot be distinguished further from this
    // response alone (see the project report).
    logIdentityDiagnostic("customer node resolved but protected fields unavailable", { count: emptyFieldCount });
  }
  if (resolvedCount > 0) {
    logIdentityDiagnostic("customer identity resolved successfully", { count: resolvedCount });
  }

  return result;
}

export function shopifyAdminCustomerUrl(shopDomain, numericCustomerId) {
  if (!shopDomain) return null;
  return `https://${shopDomain}/admin/customers/${numericCustomerId}`;
}

// Read-only introspection of what Admin API scopes this app's installation
// actually has, per Shopify's own record -- not what shopify-app/shopify.app.toml
// requests, which only reflects config that may not have been deployed/
// re-approved yet. Used by the admin-only diagnostic endpoint (see
// lib/shopify-identity-diagnostics.js) to answer "is read_customers ACTUALLY
// granted" with certainty instead of inference from a failed customer
// lookup, which could also fail for other reasons (auth, network, rate
// limiting). Never widen this query -- only the scope handles are needed.
const CURRENT_APP_INSTALLATION_SCOPES_QUERY = `
  query CurrentAppInstallationScopes {
    currentAppInstallation {
      accessScopes {
        handle
      }
    }
  }
`;

export async function fetchGrantedAdminScopes({ shopDomain, accessToken, apiVersion = DEFAULT_API_VERSION, fetchImpl = fetch }) {
  const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query: CURRENT_APP_INSTALLATION_SCOPES_QUERY })
    });
  } catch (error) {
    logIdentityDiagnostic("scope check failed", { reason: "network_error" });
    throw new Error(`shopify_admin_scopes_network_error: ${error.message}`);
  }

  if (!response.ok) {
    logIdentityDiagnostic("scope check failed", { reason: "http_error", http_status: response.status });
    throw new Error(`shopify_admin_scopes_http_${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    logIdentityDiagnostic("scope check failed", { reason: "invalid_json" });
    throw new Error("shopify_admin_scopes_invalid_json");
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    logIdentityDiagnostic("scope check failed", { reason: "graphql_error", error_count: payload.errors.length });
    throw new Error("shopify_admin_scopes_graphql_error");
  }

  const rawScopes = payload.data?.currentAppInstallation?.accessScopes;
  const scopes = Array.isArray(rawScopes) ? rawScopes.map((scope) => scope?.handle).filter((handle) => typeof handle === "string") : [];
  logIdentityDiagnostic("scope check succeeded", { granted_count: scopes.length, read_customers_granted: scopes.includes("read_customers") });
  return scopes;
}
