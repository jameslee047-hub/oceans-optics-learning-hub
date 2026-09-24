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
import { extractNumericCustomerId } from "./shopify-customer-gid.js";

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
    return config.staticAccessToken;
  }
  if (config.authMode !== "client_credentials") {
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
    throw new Error(`shopify_admin_token_network_error: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`shopify_admin_token_http_${response.status}`);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("shopify_admin_token_invalid_json");
  }

  if (typeof body.access_token !== "string" || !body.access_token) {
    throw new Error("shopify_admin_token_missing");
  }
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
  const ids = (numericCustomerIds || []).map((id) => `gid://shopify/Customer/${id}`);
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
    throw new Error(`shopify_admin_customers_network_error: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`shopify_admin_customers_http_${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("shopify_admin_customers_invalid_json");
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    // Never surface raw GraphQL error detail past this module -- e.g. a
    // missing-scope error is still safe text, but callers only need to
    // know "this batch failed" to fall back correctly.
    throw new Error(`shopify_admin_customers_graphql_error: ${payload.errors.length} error(s)`);
  }

  const result = new Map();
  const nodes = Array.isArray(payload.data?.nodes) ? payload.data.nodes : [];
  nodes.forEach((node) => {
    if (!node) return;
    let numericId;
    try {
      numericId = extractNumericCustomerId(node.id);
    } catch {
      return;
    }
    result.set(numericId, {
      displayName: typeof node.displayName === "string" && node.displayName ? node.displayName : null,
      email: typeof node.email === "string" && node.email ? node.email : null
    });
  });
  return result;
}

export function shopifyAdminCustomerUrl(shopDomain, numericCustomerId) {
  if (!shopDomain) return null;
  return `https://${shopDomain}/admin/customers/${numericCustomerId}`;
}
