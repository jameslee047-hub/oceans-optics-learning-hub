# Learning Hub Progress Backend (Phase A / A.2)

Vercel serverless backend for Learning Hub Phase 2 (customer accounts +
progress). Deployed (diagnostics only) at
`https://oceans-optics-learning-progress.vercel.app`. See the Phase A.2
report for what's still open before this becomes the real production path.

## What this is

- `api/customer-auth/start.js` + `api/customer-auth/callback.js` -- **the
  production identity mechanism as of Phase A.2**: Shopify Customer Account
  API OAuth 2.0 Authorization Code + PKCE. See "Identity model" below.
- `api/proxy/identity.js` -- **diagnostic only, not production identity**.
  The original App Proxy identity check; kept only because it's still useful
  for inspecting Shopify's (known-unreliable, under New Customer Accounts)
  App Proxy behavior. No longer writes to Supabase or mints a session token.
- `api/progress.js`, `api/lesson/[action].js` (dispatching `/viewed` and `/complete`),
  `api/quiz/result.js` -- called directly by storefront JS with
  `Authorization: Bearer <session token>`.
- `api/webhooks/*` -- the three mandatory Shopify privacy webhooks, fully
  functional: `customer.id` in the webhook payload is the same numeric
  Shopify Admin customer ID `learning_users` is keyed by, so
  `customers/redact`/`customers/data_request` map to it directly with no
  ambiguity.
- `lib/` -- the actual logic, written so it's unit-testable without a live
  Supabase connection or network access (see `test/fake-supabase.js`,
  and the injectable `fetchImpl`/`jwks` parameters throughout the OAuth code).
- `migrations/0001_init.sql` -- run manually in the Supabase SQL editor. Not
  run automatically by anything in this repo. (An earlier draft,
  `0002_customer_subject.sql`, proposed migrating identity to the OIDC `sub`
  claim; it was never run and has been removed -- identity stays the
  original numeric `shopify_customer_id`, see below.)

## Identity model

Storefront -> `GET /api/customer-auth/start` -> discovers Shopify's OIDC
endpoints from `https://oceansoptics.com/.well-known/openid-configuration`
-> redirects to Shopify's `authorization_endpoint` with a PKCE
`code_challenge` -> customer logs in via Shopify -> Shopify redirects back to
`GET /api/customer-auth/callback` with `code` + `state` -> this backend
validates the OAuth transaction (HttpOnly-cookie-held, HMAC-signed with
`SESSION_TOKEN_SECRET`), exchanges the code for tokens (public PKCE client,
no client secret), and cryptographically verifies the returned `id_token`
against Shopify's JWKS (signature/issuer/audience/expiry/nonce/`sub`
presence) -- **as a cryptographic gate only**. The verified token's `sub` is
never persisted or used as application identity.

Instead, the callback then discovers the Customer Account API's GraphQL
endpoint from `https://oceansoptics.com/.well-known/customer-account-api`
(confirmed by current Shopify documentation to return `graphql_api` and
`mcp_api`; only `graphql_api` is used) and calls it with the OAuth
`access_token` -- passed as the **raw** `Authorization` header value, per
current Shopify Customer Account API documentation, not the standard OAuth
`Authorization: Bearer <token>` scheme used elsewhere in this backend --
requesting **only** `customer { id }`. That response is a Shopify GraphQL
global ID (`gid://shopify/Customer/{numeric_id}`), validated against that
exact shape (and that `graphql_api` itself is a valid HTTPS URL) and never
trusted otherwise; the numeric suffix is extracted as `shopify_customer_id`
-- the same identity Shopify's `customers/redact`/`customers/data_request`
webhooks use, and the same schema Phase A shipped
(`learning_users.shopify_customer_id bigint unique not null`, unchanged).
This `shopify_customer_id` finds/creates the `learning_users` row and is
what this backend's own short-lived Learning Progress token is minted with.

No endpoint ever trusts a customer identity supplied directly by browser
JS -- only the verified session token (and, for `/customer-auth/callback`
itself, the cryptographically verified `id_token` plus the Customer Account
API's own authenticated response).

## Required environment variables

| Variable | Value | Purpose |
|---|---|---|
| `SUPABASE_URL` | (Supabase project URL) | Server-side Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | (Supabase service-role key) | Server-side Supabase client -- never sent to the browser |
| `SHOPIFY_API_SECRET` | (app's client secret) | App Proxy signature verification (diagnostic-only), webhook HMAC verification. NOT used for the Customer Account OAuth token exchange (that's a public PKCE client) |
| `SESSION_TOKEN_SECRET` | (random secret) | Signs/verifies this backend's own Learning Progress session token and the OAuth transaction cookie |
| `SHOPIFY_CLIENT_ID` | `095af359420e5400dc385150e9b4c8e4` | The app's public OAuth client_id, used in the authorization request and token exchange |
| `SHOP_STOREFRONT_DOMAIN` | `oceansoptics.com` | The storefront custom domain used for **Customer Account API / OIDC discovery** (`.well-known/openid-configuration`, `.well-known/customer-account-api`) |
| `SHOPIFY_SHOP_DOMAIN` | `a44b34.myshopify.com` | The shop's canonical `.myshopify.com` identity, used for **internal session shop-binding** (rejecting a session token minted for a different shop) and **compliance webhook verification** (`shop/redact`'s `shop_domain` check) |

`SHOP_STOREFRONT_DOMAIN` and `SHOPIFY_SHOP_DOMAIN` are two different domains
for two different purposes and must not be confused or merged: one is where
Shopify serves the OAuth/Customer-Account discovery documents, the other is
this shop's permanent internal identity.

## Setup

1. `npm install` (installs `@supabase/supabase-js` and `jose`).
2. Copy `.env.example` to `.env.local` and fill in real values (see the table
   above), or set the same variables as Vercel Environment Variables for the
   deployed project -- including `SHOPIFY_SHOP_DOMAIN`, which is not
   currently configured in Vercel but is required (see the table above for
   why).
3. Run `migrations/0001_init.sql` against the Supabase project (if not
   already applied).
4. Redeploy to Vercel with the environment variables above set.
5. In `shopify-app/shopify.app.toml`, the `[customer_authentication]` block's
   `redirect_uris` must exactly match the deployed callback URL, and
   `[access_scopes]` must include `customer_read_customers` (a Customer
   Account API scope -- not the Admin API `read_customers`). A new app
   config version needs to be released (`shopify app deploy`) for Shopify to
   pick either of these up -- not done as part of this change; see the
   Phase A.2 report.

## Tests

```
npm test
```

Runs entirely offline: Node's built-in test runner, a fake in-memory
Supabase stand-in, synthetic Shopify-shaped requests, injectable
discovery/token-exchange/GraphQL `fetch`, and a locally-generated test
keypair for real (not mocked) JWT/JWKS cryptographic verification via
`jose`. Proves the PKCE/state/nonce/token/GID-validation/upsert/validation
logic is correct. It does **not** and cannot prove Shopify's live OAuth or
Customer Account API behavior against the real store -- that requires an
actual browser login against the deployed callback URL (see the Phase A.2
report's manual next steps).
