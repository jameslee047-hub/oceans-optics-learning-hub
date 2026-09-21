// Exchanges an authorization code for tokens at Shopify's discovered
// token_endpoint. This is a PUBLIC PKCE client (per [customer_authentication]
// in shopify-app/shopify.app.toml, a public OAuth client) -- deliberately
// sends no client_secret and no Authorization/Basic header. Do not add
// either; that would be sending SHOPIFY_API_SECRET (a confidential-client
// credential) to a public-client token endpoint, which Shopify's PKCE
// client does not expect and which this backend must not do per the Phase
// A.2 spec.
export async function exchangeAuthorizationCode({
  tokenEndpoint,
  clientId,
  redirectUri,
  code,
  codeVerifier,
  fetchImpl = fetch
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier
  });

  let response;
  try {
    response = await fetchImpl(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
  } catch (error) {
    throw new Error(`token_exchange_network_error: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`token_exchange_http_${response.status}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("token_exchange_invalid_json");
  }

  if (typeof data.id_token !== "string" || !data.id_token) {
    throw new Error("token_exchange_missing_id_token");
  }

  // This backend never stores or forwards access_token to the browser (see
  // api/customer-auth/callback.js) -- only id_token.payload.sub is used,
  // and only after cryptographic verification.
  return data;
}
