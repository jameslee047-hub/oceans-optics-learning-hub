// Dynamically discovers Shopify's Customer Account API OAuth endpoints from
// the shop's OIDC discovery document. Never hardcode
// authorization/token/jwks endpoints -- Shopify owns and can change them.
const REQUIRED_FIELDS = ["authorization_endpoint", "token_endpoint", "jwks_uri", "issuer"];

export async function discoverOidcConfiguration(shopStorefrontDomain, { fetchImpl = fetch } = {}) {
  if (!shopStorefrontDomain) throw new Error("shopStorefrontDomain is required for OIDC discovery");

  const url = `https://${shopStorefrontDomain}/.well-known/openid-configuration`;

  let response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new Error(`oidc_discovery_network_error: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`oidc_discovery_http_${response.status}`);
  }

  let config;
  try {
    config = await response.json();
  } catch (error) {
    throw new Error("oidc_discovery_invalid_json");
  }

  for (const field of REQUIRED_FIELDS) {
    if (typeof config[field] !== "string" || !config[field]) {
      throw new Error(`oidc_discovery_missing_field:${field}`);
    }
  }

  return config;
}
