# Stage 5B Shopify Read-Only Preflight

Generated at: 2026-08-25T08:51:51.268Z

Stage 5B is read-only. This report contains no access tokens and no mutations were executed.

Authentication prefers Shopify's client credentials grant for server-side integrations acting on stores in the same Shopify organization. A legacy Admin API access token is supported only as a fallback for an existing legacy custom app.

## Connection

- Authentication method: `client_credentials`
- Authentication succeeded: YES
- Client credentials preferred: YES
- Legacy token fallback used: NO
- Intended store confirmed: YES
- API version confirmed: YES
- Requested API version: `2026-07`
- Actual API versions returned: `2026-07`
- Shop name: `Oceans Optics`
- Primary domain: `oceansoptics.com`
- MyShopify domain: `a44b34.myshopify.com`
- Shopify plan: `Basic`

## Existing Definitions

_No relevant definitions found._

## Existing Entries

_No relevant entries inspected._

## `/pages/learn` Status

_No Shopify Page with handle `learn` found._

## Theme Status

- Live theme name: `V3.02`
- Live theme ID: `gid://shopify/OnlineStoreTheme/176147136845`
- Development/unpublished themes: 12
- Contains templates/metaobject/: NO

Learning/guide-related theme assets:

- sections/fs-cylinder-guide.liquid
- sections/guide-product-page.liquid
- sections/ns-cylinder-guide.liquid
- sections/Snorkel-101-guide.liquid
- templates/page.free-guide.context.eu.json
- templates/page.free-guide.json
- templates/page.learning-zone.json
- templates/page.rx_titan_size_guide.json
- templates/product.e-guide.json

## Available Scopes

- `read_files`
- `read_metaobject_definitions`
- `read_metaobjects`
- `read_online_store_pages`
- `read_products`
- `read_themes`
- `write_metaobject_definitions`
- `write_metaobjects`

## Required Stage 5B Preflight Read Scopes

- `read_metaobject_definitions`
- `read_metaobjects`
- `read_online_store_pages`
- `read_themes`
- `read_products`
- `read_files`

Missing Stage 5B read scopes from current connection:
_None._

## Required Stage 5C Scopes

Minimum:
- `write_metaobject_definitions`
- `write_metaobjects`

Missing minimum from current connection:
_None._

Later only if required:
- `write_files`

Stage 5B should use read scopes only. Stage 5C writes later need metaobject write scopes; file writes should be added only if upload automation is required. Theme development should use Shopify CLI or a separately scoped theme workflow rather than automatically broadening this Admin API credential.

## Stage 5A Schema Compatibility

- Checked against live API: YES
- Missing planned field types: none reported

Planned field type support:

- single_line_text_field: supported
- multi_line_text_field: supported
- rich_text_field: supported
- number_integer: supported
- date: supported
- file_reference: supported
- list.file_reference: supported
- metaobject_reference: supported
- list.metaobject_reference: supported
- list.product_reference: supported
- link: supported
- list.link: supported

## Reference Validation Syntax

```json
{
  "plannedDefinitionOwnership": "merchant-owned metaobject definitions with simple type names",
  "recommendation": "In Stage 5C, create/read category and lesson definitions first, then prefer metaobject_definition_id validations using returned definition GIDs. If using type-based validations, use the exact runtime definition type string.",
  "graphqlById": {
    "name": "metaobject_definition_id",
    "lessonToCategoryValue": "gid://shopify/MetaobjectDefinition/{learning_category_definition_id}",
    "lessonToRelatedLessonsValue": "gid://shopify/MetaobjectDefinition/{learning_lesson_definition_id}",
    "pathwayToOrderedLessonsValue": "gid://shopify/MetaobjectDefinition/{learning_lesson_definition_id}"
  },
  "graphqlByType": {
    "name": "metaobject_definition_type",
    "lessonToCategoryValue": "learning_category",
    "lessonToRelatedLessonsValue": "learning_lesson",
    "pathwayToOrderedLessonsValue": "learning_lesson"
  },
  "docs": "Shopify GraphQL validation options support metaobject_definition_id or metaobject_definition_type for metaobject_reference and list.metaobject_reference."
}
```

## Upsert Behavior Confirmation

metaobjectUpsert creates or updates by handle. With the metaobject input, only supplied fields are updated and omitted fields are preserved. The values argument is a full replacement and clears omitted keys.

## Publication/Draft Behavior Confirmation

The publishable capability supports DRAFT and ACTIVE. Stage 5C should create all pilot lessons, categories, and pathways as DRAFT until templates and review gates are ready.

## Blocking Issues

_None._

## Warnings

- No product with handle `prescription-mask-collection` was found. This may be a collection or unresolved placeholder rather than a product handle.

## Safe to Proceed to Stage 5C?

YES

YES. Read-only preflight did not find blocking issues. Stage 5C writes should still begin with DRAFT entries only.

## Official Sources

- https://shopify.dev/docs/apps/build/authentication-authorization
- https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant
- https://shopify.dev/docs/apps/build/authentication-authorization/manage-credentials
- https://shopify.dev/docs/api/usage/access-scopes
- https://shopify.dev/docs/apps/build/metaobjects/use-metaobject-capabilities
- https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions
- https://shopify.dev/docs/apps/build/metafields/list-of-data-types
- https://shopify.dev/docs/apps/build/metafields/list-of-validation-options
- https://shopify.dev/docs/api/admin-graphql/2026-07/queries/metafieldDefinitionTypes
- https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/metaobjectUpsert
- https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject

