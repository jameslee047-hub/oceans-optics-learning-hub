# `learning_lesson` Metaobject Specification

## Definition

- Definition type: `learning_lesson`
- Name: Learning Lesson
- Display-name field: `title`
- Merchant/Admin access: inherent for merchant-owned definitions; do not specify `access.admin`
- Storefront access: `PUBLIC_READ`
- Capabilities:
  - `publishable`: enabled
  - `renderable`: enabled
  - `onlineStore`: enabled
- Online Store URL handle: `learn`
- Resulting URL pattern: `/pages/learn/{lesson-handle}`
- Renderable SEO aliases:
  - Meta title: `seo_title`
  - Meta description: `meta_description`

## Official Shopify Verification

- Metaobject capabilities: https://shopify.dev/docs/apps/build/metaobjects/use-metaobject-capabilities
- Metaobject definitions: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions
- Metaobject field types: https://shopify.dev/docs/apps/build/metafields/list-of-data-types
- Metaobject theme templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject

Shopify's current documentation supports `publishable`, `renderable`, and `onlineStore` capabilities. The Online Store capability uses the documented `/pages/{urlHandle}/{entry-handle}` pattern, so `urlHandle: learn` supports `/pages/learn/{lesson-handle}`.

## Access Rule

`learning_lesson` is a merchant-owned metaobject definition. Merchant/Admin access is inherent for this ownership model, so definition create payloads must not send `access.admin`. Storefront access is configured separately with `access.storefront: PUBLIC_READ`.

## Field Specification

This lean publication model uses 22 fields.

| Field key | Admin label | Field type | Validation/reference target | Required |
| --- | --- | --- | --- | --- |
| `title` | Title | `single_line_text_field` | Display-name field | Required |
| `short_description` | Short description | `multi_line_text_field` | Used for cards and page intro | Required |
| `lesson_type` | Lesson type | `single_line_text_field` | Controlled by repository data | Required |
| `category` | Primary category | `metaobject_reference` | `learning_category` | Required |
| `estimated_reading_time` | Estimated reading time | `single_line_text_field` | Preserves ranges such as `3-5 minutes` | Required |
| `hero_media` | Hero media | `file_reference` | Image/video file when present | Optional |
| `lesson_body` | Lesson body | `rich_text_field` | Shopify rich text JSON generated from public Markdown | Required |
| `instructor_tips` | Instructor tips | `rich_text_field` | Public Markdown converted to rich text | Optional |
| `common_mistakes` | Common mistakes | `rich_text_field` | Public Markdown converted to rich text | Optional |
| `safety_notes` | Safety notes | `rich_text_field` | Public, reviewed safety copy only | Optional |
| `key_takeaways` | Key takeaways | `list.single_line_text_field` | List of short public strings | Optional |
| `related_lessons` | Related lessons | `list.metaobject_reference` | `learning_lesson`; ordered editorial list | Optional |
| `related_tools` | Related tools | `list.link` | Only include resolved public URLs | Optional |
| `related_products` | Related products | `list.product_reference` | Only include resolved product GIDs | Optional |
| `downloadable_resources` | Downloadable resources | `list.file_reference` | Only include resolved Shopify File GIDs | Optional |
| `primary_cta` | Primary CTA | `link` | Only include a resolved public URL | Optional |
| `lesson_id` | Lesson ID | `single_line_text_field` | Stable ID such as `R01` | Required |
| `author` | Author | `single_line_text_field` | Human/public-safe value only | Optional |
| `reviewer` | Reviewer | `single_line_text_field` | Human/public-safe value only | Optional |
| `last_reviewed` | Last reviewed | `date` | ISO date after review | Optional |
| `seo_title` | SEO title | `single_line_text_field` | Renderable SEO title alias | Optional |
| `meta_description` | Meta description | `multi_line_text_field` | Renderable SEO description alias | Optional |

## Deliberate Omissions

Do not send these repository-only fields to Shopify:

- source IDs
- source files
- source confidence
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

Publication state should use Shopify's `publishable` capability: `DRAFT` or `ACTIVE`.

## Notes

- `estimated_reading_time` is a string instead of `number_integer` because the approved pilot lessons use ranges such as `3-5 minutes`.
- The lesson entry does not store pathway membership. `learning_pathway.ordered_lessons` is canonical, and any lesson-page pathway display should be derived later.
- Never send development authors such as `Codex draft` to Shopify.
