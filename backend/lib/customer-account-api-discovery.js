// Discovers the Shopify Customer Account API's GraphQL endpoint from the
// shop's dedicated discovery document -- a DIFFERENT document from
// .well-known/openid-configuration (which only covers the OAuth
// authorization/token/jwks endpoints used to obtain tokens in the first
// place). Never hardcode the GraphQL endpoint or API version.
//
// Per current Shopify Customer Account API documentation, this document
// contains (at least) `graphql_api` and `mcp_api`. Only `graphql_api` is
// used here -- it's the field this backend's `customer { id }` lookup
// needs (see lib/customer-account-graphql.js).
const REQUIRED_FIELD = "graphql_api";

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch (error) {
    return false;
  }
}

export async function discoverCustomerAccountApi(shopStorefrontDomain, { fetchImpl = fetch } = {}) {
  if (!shopStorefrontDomain) throw new Error("shopStorefrontDomain is required for Customer Account API discovery");

  const url = `https://${shopStorefrontDomain}/.well-known/customer-account-api`;

  let response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new Error(`customer_account_api_discovery_network_error: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`customer_account_api_discovery_http_${response.status}`);
  }

  let config;
  try {
    config = await response.json();
  } catch (error) {
    throw new Error("customer_account_api_discovery_invalid_json");
  }

  if (typeof config[REQUIRED_FIELD] !== "string" || !config[REQUIRED_FIELD]) {
    throw new Error(`customer_account_api_discovery_missing_field:${REQUIRED_FIELD}`);
  }

  if (!isHttpsUrl(config[REQUIRED_FIELD])) {
    throw new Error(`customer_account_api_discovery_invalid_url:${REQUIRED_FIELD}`);
  }

  return config;
}
