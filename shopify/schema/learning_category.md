# `learning_category` Metaobject Specification

## Definition

- Definition type: `learning_category`
- Name: Learning Category
- Display-name field: `title`
- Merchant/Admin access: inherent for merchant-owned definitions; do not specify `access.admin`
- Storefront access: `PUBLIC_READ`
- Capabilities:
  - `publishable`: enabled
  - `renderable`: enabled
  - `onlineStore`: enabled
- Online Store URL handle: `learn-category`
- Resulting URL pattern: `/pages/learn-category/{category-handle}`
- Renderable SEO aliases:
  - Meta title: `title`
  - Meta description: `short_description`

## Launch Decision

Create public category pages at launch. They materially improve navigation and SEO because the Learning Hub has five durable categories that users can browse independently.

Keep the model minimal. Lessons retain the canonical primary-category reference, so category entries do not store manual lesson lists.

## Access Rule

`learning_category` is a merchant-owned metaobject definition. Merchant/Admin access is inherent for this ownership model, so definition create payloads must not send `access.admin`. Storefront access is configured separately with `access.storefront: PUBLIC_READ`.

## Official Shopify Verification

- Metaobject capabilities: https://shopify.dev/docs/apps/build/metaobjects/use-metaobject-capabilities
- Metaobject definitions: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions
- Metaobject field types: https://shopify.dev/docs/apps/build/metafields/list-of-data-types
- Metaobject theme templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject

## Field Specification

This launch model uses 4 fields.

| Field key | Admin label | Field type | Validation/reference target | Required |
| --- | --- | --- | --- | --- |
| `title` | Title | `single_line_text_field` | Display-name field | Required |
| `short_description` | Short description | `multi_line_text_field` | Card copy and SEO description alias | Required |
| `image` | Image or icon | `file_reference` | Image file when present | Optional |
| `sort_order` | Sort order | `number_integer` | Stable hub display order | Required |

## Relationship Model

- `learning_lesson.category` points to one `learning_category`.
- Category pages should retrieve lessons by that primary category reference.
- Do not duplicate lesson lists on categories unless the real Liquid implementation proves it is necessary.
