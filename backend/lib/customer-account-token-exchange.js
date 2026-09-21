// Exchanges an authorization code for tokens at Shopify's discovered
// token_endpoint. This is a PUBLIC PKCE client (per [customer_authentication]
// in shopify-app/shopify.app.toml, a public OAuth client) -- deliberately
// sends no client_secret and no Authorization/Basic header. Do not add
// either; that would be sending SHOPIFY_API_SECRET (a confidential-client
// credential) to a public-client token endpoint, which Shopify's PKCE
// client does not expect and which this backend must not do per the Phase
// A.2 spec.
//
// Expected successful response shape (current Shopify documentation):
// { access_token: string, id_token: string, expires_in: number }. Returned
// as-is, with no renaming/destructuring -- callers read access_token/
// id_token directly off the returned object.
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

  // Read the body exactly once, whether the response is an error or a
  // success -- Response.json() throws if the body isn't valid JSON, so
  // errors are read the same way successes are, and reused below rather
  // than reading twice (which would throw "body already used").
  let data = null;
  let parseError = null;
  try {
    data = await response.json();
  } catch (error) {
    parseError = error;
  }

  if (!response.ok) {
    // Shopify's OAuth error responses are documented as JSON shaped like
    // { error: "invalid_grant", error_description: "..." }. Both fields are
    // Shopify's own safe, documented OAuth error vocabulary -- never a
    // token, code, or verifier -- so they're safe to surface in a thrown
    // error message for server-side diagnostics (never returned to the
    // browser; see api/customer-auth/callback.js, which maps any exchange
    // failure to a single generic "token_exchange_failed").
    const oauthErrorCode = data && typeof data.error === "string" ? data.error : "unknown";
    const oauthErrorDescription = data && typeof data.error_description === "string" ? data.error_description : "";
    throw new Error(
      `token_exchange_http_${response.status}: ${oauthErrorCode}${oauthErrorDescription ? ` (${oauthErrorDescription})` : ""}`
    );
  }

  if (parseError) {
    throw new Error("token_exchange_invalid_json");
  }

  if (typeof data.access_token !== "string" || !data.access_token || typeof data.id_token !== "string" || !data.id_token) {
    // Never include the actual response values here -- only which top-level
    // keys were present, so a shape mismatch (e.g. Shopify renaming a
    // field) is diagnosable from logs without ever exposing a real
    // access_token/id_token.
    const presentKeys = Object.keys(data || {});
    throw new Error(`token_exchange_missing_fields: keys_present=${JSON.stringify(presentKeys)}`);
  }

  return data;
}
