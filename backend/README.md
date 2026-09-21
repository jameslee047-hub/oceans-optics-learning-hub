# Learning Hub Progress Backend (Phase A)

Vercel serverless backend for Learning Hub Phase 2 (customer accounts +
progress). Not deployed yet -- see the Phase A audit report for what's
blocking that and what James needs to set up first.

## What this is

- `api/proxy/identity.js` -- the only endpoint Shopify calls (via App Proxy,
  server-to-server). Verifies the App Proxy signature, looks up/creates the
  `learning_users` row for a logged-in customer, and mints a short-lived
  session token.
- `api/progress.js`, `api/lesson/viewed.js`, `api/lesson/complete.js`,
  `api/quiz/result.js` -- called directly by storefront JS with
  `Authorization: Bearer <session token>`. Never go through the App Proxy.
- `api/webhooks/*` -- the three mandatory Shopify privacy webhooks
  (`customers/redact`, `customers/data_request`, `shop/redact`).
- `lib/` -- the actual logic, written so it's unit-testable without a live
  Supabase connection (see `test/fake-supabase.js`).
- `migrations/0001_init.sql` -- run manually in the Supabase SQL editor (or
  via the Supabase CLI) once a project exists. Not run automatically by
  anything in this repo.

## Identity model

Storefront -> `/apps/learning-progress/identity` -> Shopify App Proxy (signs
the request, injects `logged_in_customer_id`) -> this backend verifies the
signature -> mints a 30-minute session token -> browser holds that token in
memory/`sessionStorage` (never `localStorage`) and sends it as a bearer token
to every other endpoint. No endpoint other than `api/proxy/identity.js` ever
trusts a customer ID from anywhere except that verified token.

## Setup (when James is ready to deploy)

1. `npm install` (installs `@supabase/supabase-js`).
2. Copy `.env.example` to `.env.local` and fill in real values, or set the
   same variables as Vercel Environment Variables for the deployed project.
3. Run `migrations/0001_init.sql` against the Supabase project.
4. `vercel deploy` (or connect the repo in the Vercel dashboard, with `backend/`
   as the project root).
5. In the Shopify custom app's configuration, set the App Proxy: prefix
   `apps`, subpath `learning-progress`, URL `https://<vercel-project>.vercel.app/api/proxy`.
6. Register the three webhooks (`customers/redact`, `customers/data_request`,
   `shop/redact`) pointing at `https://<vercel-project>.vercel.app/api/webhooks/<name>`.

## Tests

```
npm test
```

Runs entirely offline (Node's built-in test runner, a fake in-memory
Supabase stand-in, synthetic Shopify-shaped requests) -- proves the
signature/token/upsert/validation logic is correct. It does **not** and
cannot prove Shopify's live App Proxy behavior against the real store; that
requires an actual deployment and a live login/logout cycle (see the Phase A
report's "Identity Proof Result").
