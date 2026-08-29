# Shopify Learning Hub Scaffold

Stage 5A is local-only implementation scaffolding. Stage 5B adds a read-only Shopify preflight command. Nothing in this folder performs Shopify mutations, edits a theme, creates PDFs, or drafts new lessons.

## Flow

```text
approved repository sources
-> normalized Shopify publication JSON
-> validation report
-> local GraphQL payload skeletons
-> dry-run report
```

The current commands are run from this folder:

```sh
npm run learning:generate-pilots
npm run learning:validate
npm run learning:build-payloads
npm run learning:dry-run
npm run learning:shopify-preflight
npm run learning:shopify-create-drafts
```

`learning:shopify-preflight` may make read-only Shopify network requests after credentials are configured. It rejects GraphQL mutation operations before sending a request.

`learning:shopify-create-drafts` is the Stage 5C write command. It is strictly limited to creating the three Learning Hub definitions, five category draft entries, and three pilot lesson draft entries. It does not create pathway entries, pages, theme assets, files, products, menus, discounts, or additional lessons.

## Source of Truth

The repository remains the editorial source of truth.

Primary inputs:

- `../planning/learning-hub-architecture-v2/`
- `../content-development/`

Local Shopify outputs:

- `schema/*.md`: human-readable metaobject specs
- `schema/definitions.json`: machine-readable local schema
- `data/categories.json`: normalized category entries
- `data/pathways.json`: normalized current pathway entries
- `data/lessons/*.json`: normalized pilot lesson entries
- `generated/*.json`: validation, payload, and dry-run reports

## What Never Enters Shopify

The normalized Shopify data must not contain:

- source IDs
- source files
- source confidence
- extraction notes
- content gaps
- instructor input opportunities
- fact-check requirements
- safety-review requirements
- current-guidance requirements
- omitted content
- duplicate consolidation notes
- visual briefs
- review tags
- publication-readiness commentary
- development authors such as `Codex draft`

The validator checks for common internal markers and US-English terminology issues.

## Stable Handles

Metaobject identity is based on type plus handle:

- lesson: `learning_lesson` + lesson slug, such as `choosing-a-mask`
- category: `learning_category` + category slug, such as `safety-conditions`
- pathway: `learning_pathway` + pathway slug, such as `start-here`

The file `data/approved-lesson-handles.json` exists only to validate approved future lesson references. It is not a content draft for R02-R30.

## Draft and Active

Stage 5A keeps every generated entry as `DRAFT`.

Later, Shopify's `publishable` capability should control publication:

- `DRAFT`: imported, previewable, not public
- `ACTIVE`: approved for storefront rendering

R08 and R12 must remain unsuitable for `ACTIVE` publication until required safety/current-guidance review is complete and `reviewer` plus `last_reviewed` are populated with approved human values.

## Future Live Sync

The payload builder creates local skeletons for:

- `metaobjectDefinitionCreate`
- `metaobjectUpsert`

No requests are sent. Reference fields use resolver tokens until a future live sync can resolve real Shopify GIDs.

The selected upsert style uses the `metaobject` input form for `metaobjectUpsert`. Shopify updates only fields provided in that input and preserves omitted fields on existing records. Do not switch to the `values` argument unless the sync intentionally supplies every managed field, because `values` is a full replacement and clears omitted keys.

Unresolved tools, products, files, and CTAs are warned during validation and omitted from payload fields until public URLs or Shopify GIDs exist.

## Stage 5B Authentication

For a server-side integration acting on the Oceans Optics store in our own Shopify organization, use Shopify's current client credentials grant.

Create a local `shopify/.env` from `.env.example`:

```text
SHOPIFY_STORE_DOMAIN=
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_API_VERSION=2026-07

# Optional legacy fallback only for an existing admin-created/custom app.
SHOPIFY_ADMIN_ACCESS_TOKEN=
```

Preferred authentication order:

1. If `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` exist, the preflight client uses the client credentials grant.
2. Otherwise, if `SHOPIFY_ADMIN_ACCESS_TOKEN` exists, the preflight client uses it as a backwards-compatible legacy fallback.
3. Otherwise, the command stops safely without network requests.

The client credentials flow requests an Admin API access token at runtime from Shopify's OAuth token endpoint. The generated access token is kept in memory only and is refreshed before expiry. It is never written to `.env`, JSON, Markdown, logs, or Git.

Secrets policy:

- `.env` is ignored by Git.
- `SHOPIFY_CLIENT_SECRET` is never printed.
- generated access tokens are never printed.
- legacy Admin API access tokens are never printed.
- generated reports only state whether authentication succeeded.

Use the store's `*.myshopify.com` domain for `SHOPIFY_STORE_DOMAIN`. The script also accepts the bare shop subdomain and appends `.myshopify.com`.

## Stage 5B Preflight Scopes

Read-only preflight scopes:

- `read_metaobject_definitions`
- `read_metaobjects`
- `read_online_store_pages`
- `read_themes`
- `read_products`
- `read_files`

Do not add write scopes for Stage 5B unless Shopify app configuration forces future scopes to be declared together.

Stage 5C later needs:

- `write_metaobject_definitions`
- `write_metaobjects`

Later, only if file upload automation is required:

- `write_files`

## URL Architecture

- Hub homepage: `/pages/learn`
- Lessons: `/pages/learn/{lesson-handle}`
- Categories: `/pages/learn-category/{category-handle}`
- Pathways: `/pages/learn-pathway/{pathway-handle}`

`learning_lesson` uses `onlineStore.urlHandle = learn`. Category and pathway pages are also planned as public Online Store metaobject pages because they materially improve navigation and SEO.

## Official Shopify Sources

- Authentication overview: https://shopify.dev/docs/apps/build/authentication-authorization
- Client credentials grant: https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant
- App credentials: https://shopify.dev/docs/apps/build/authentication-authorization/manage-credentials
- Access scopes: https://shopify.dev/docs/api/usage/access-scopes
- Metaobject capabilities: https://shopify.dev/docs/apps/build/metaobjects/use-metaobject-capabilities
- Metaobject definitions: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions
- Metaobject field types: https://shopify.dev/docs/apps/build/metafields/list-of-data-types
- Metaobject upsert: https://shopify.dev/docs/api/admin-graphql/latest/mutations/metaobjectUpsert
- Metaobject theme templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject
- File creation: https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate

## Safe Dry Run

Run:

```sh
cd shopify
npm run learning:dry-run
```

The dry run writes:

- `generated/validation-report.json`
- `generated/shopify-payloads.json`
- `generated/dry-run-report.json`

It reports definitions and entries that would be created/upserted later, unresolved references, blocking validation errors, and warnings. It performs no network requests.

## Safe Store Preflight

After `shopify/.env` is configured, run:

```sh
cd shopify
npm run learning:shopify-preflight
```

The preflight command:

- obtains a runtime access token if using client credentials
- keeps tokens in memory only
- performs read-only GraphQL and REST reads
- rejects GraphQL mutation documents
- writes `STAGE-5B-PREFLIGHT.md`
- writes `generated/shopify-preflight-report.json`

It does not create, update, delete, upload, publish, or mutate anything.

## Stage 5C Draft Creation

Only after Stage 5B has passed, run:

```sh
cd shopify
npm run learning:shopify-create-drafts
```

The command performs pre-write checks before any mutation:

- confirms the shop is Oceans Optics
- confirms the MyShopify domain is `a44b34.myshopify.com`
- confirms Admin GraphQL API `2026-07`
- confirms `write_metaobject_definitions` and `write_metaobjects`
- compares and reuses matching approved Learning Hub definitions or entries
- stops if an existing approved handle differs from the local Stage 5C payload
- stops if unexpected Learning Hub definitions or entry handles already exist
- runs local validation

Definition access rule:

- `learning_category`, `learning_lesson`, and `learning_pathway` are merchant-owned metaobject definitions.
- Merchant/Admin access is inherent for merchant-owned definitions.
- Do not send `access.admin` for these simple `learning_*` types.
- Keep `access.storefront: PUBLIC_READ` where the approved public Learning Hub architecture requires storefront visibility.
- Do not switch these definitions to `$app:` types.

Stage 5C is resumable. If the `learning_category` definition from the accepted partial run exists and matches the approved schema, it is reused and reported as `REUSED FROM PARTIAL RUN`; it must not be deleted or recreated.

Do not query `onlineStoreUrl` from Admin API `Metaobject` responses. Stage 5C reports lesson URLs only as the derived `Expected URL pattern`, using `https://oceansoptics.com/pages/learn/{handle}`, and does not claim DRAFT entries are live public URLs.

`learning_lesson.related_lessons` is a self-reference. Stage 5C creates `learning_lesson` without that field first, then immediately uses `metaobjectDefinitionUpdate` to add `related_lessons` with `metaobject_definition_id` set to the returned `learning_lesson` definition GID. The final schema must still include `related_lessons` as `list.metaobject_reference`.

Permitted Stage 5C writes:

- create `learning_category`
- create five DRAFT category entries
- create `learning_lesson`
- create three DRAFT pilot lesson entries: R01, R08, R12
- create `learning_pathway`

Explicitly not permitted in Stage 5C:

- pathway entries
- `/pages/learn`
- R02-R07, R09-R11, R13-R30
- files/PDFs/images
- products or collections
- themes/templates/sections/snippets
- menus/navigation
- quiz metaobjects

The command writes:

- `STAGE-5C-RESULT.md`
- `generated/stage-5c-created-resources.json`
