// Calls the Shopify Customer Account API's GraphQL endpoint with the
// access_token obtained from the OAuth token exchange, requesting ONLY
// `customer { id }` -- no name, email, phone, address, orders, or any other
// field. Do not widen this query without a documented, separately-approved
// reason: it exists specifically to get the authenticated customer's GID
// with the minimum possible data exposure.
const CUSTOMER_ID_QUERY = "query { customer { id } }";

export async function fetchAuthenticatedCustomerId({ graphqlEndpoint, accessToken, fetchImpl = fetch }) {
  let response;
  try {
    response = await fetchImpl(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Per current Shopify Customer Account API documentation, this
        // endpoint expects the raw access_token as the Authorization header
        // value -- NOT a "Bearer " prefix (unlike the standard OAuth bearer
        // convention used elsewhere, e.g. this backend's own
        // Authorization: Bearer <session token> on the direct progress
        // endpoints). Do not add a Bearer prefix here.
        Authorization: accessToken
      },
      body: JSON.stringify({ query: CUSTOMER_ID_QUERY })
    });
  } catch (error) {
    throw new Error(`customer_account_api_network_error: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`customer_account_api_http_${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("customer_account_api_invalid_json");
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    // Never include the raw GraphQL error detail in what bubbles up to a
    // client response -- callers should log this server-side only if
    // needed, and never alongside the access token.
    throw new Error(`customer_account_api_graphql_error: ${payload.errors.length} error(s)`);
  }

  const customerGid = payload.data?.customer?.id;
  if (typeof customerGid !== "string" || !customerGid) {
    throw new Error("customer_account_api_missing_customer");
  }

  return customerGid;
}
