# `learning_pathway` Metaobject Specification

## Definition

- Definition type: `learning_pathway`
- Name: Learning Pathway
- Display-name field: `title`
- Merchant/Admin access: inherent for merchant-owned definitions; do not specify `access.admin`
- Storefront access: `PUBLIC_READ`
- Capabilities:
  - `publishable`: enabled
  - `renderable`: enabled
  - `onlineStore`: enabled
- Online Store URL handle: `learn-pathway`
- Resulting URL pattern: `/pages/learn-pathway/{pathway-handle}`
- Renderable SEO aliases:
  - Meta title: `title`
  - Meta description: `short_description`

## Launch Decision

Create public pathway pages at launch for the five current pathways. Pathways materially improve beginner navigation because they present ordered learning routes across categories.

Do not publish the future Prescription Masks & Underwater Vision pathway in phase one. The schema supports it later, but there should be no phase-one entry for that future pathway.

Use Shopify's `publishable` capability instead of a custom `pathway_status` field.

## Access Rule

`learning_pathway` is a merchant-owned metaobject definition. Merchant/Admin access is inherent for this ownership model, so definition create payloads must not send `access.admin`. Storefront access is configured separately with `access.storefront: PUBLIC_READ`.

## Official Shopify Verification

- Metaobject capabilities: https://shopify.dev/docs/apps/build/metaobjects/use-metaobject-capabilities
- Metaobject definitions: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions
- Metaobject field types: https://shopify.dev/docs/apps/build/metafields/list-of-data-types
- Metaobject theme templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject
- Metaobject upsert: https://shopify.dev/docs/api/admin-graphql/latest/mutations/metaobjectUpsert

## Field Specification

This launch model uses 4 fields.

| Field key | Admin label | Field type | Validation/reference target | Required |
| --- | --- | --- | --- | --- |
| `title` | Title | `single_line_text_field` | Display-name field | Required |
| `short_description` | Short description | `multi_line_text_field` | Card copy and SEO description alias | Required |
| `image` | Image or icon | `file_reference` | Image file when present | Optional |
| `ordered_lessons` | Ordered lessons | `list.metaobject_reference` | `learning_lesson`; array order is pathway order | Required |

## Ordering Rule

`ordered_lessons` is canonical. The importer must write lesson references in the exact approved v2 order, and the theme must render them in the stored order.

Do not require humans to maintain pathway membership separately on lesson entries.
