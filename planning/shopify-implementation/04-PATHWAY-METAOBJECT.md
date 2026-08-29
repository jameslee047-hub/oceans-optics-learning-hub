# Learning Pathway Metaobject

## Recommendation

Create a `learning_pathway` metaobject. Store the deliberate lesson sequence in one ordered `list.metaobject_reference<learning_lesson>` field called `ordered_lessons`.

Lesson order should be preserved by the order of IDs in that Shopify list value, which is stored as a JSON array. The import script should generate the list in the exact approved pathway order and the theme should render the references in received order.

## Current Pathways

- Start Here
- Safer Snorkeling
- Equipment Essentials
- In-Water Skills Builder
- Ocean-Aware Snorkeler

Future:

- Prescription Masks & Underwater Vision

## Official Shopify Docs Checked

- Metafield/metaobject data types: https://shopify.dev/docs/apps/build/metafields/list-of-data-types
- Data modeling with references: https://shopify.dev/docs/apps/build/metaobjects/data-modeling-with-metafields-and-metaobjects
- Metaobject capabilities: https://shopify.dev/docs/apps/build/metaobjects/use-metaobject-capabilities
- Metaobject templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject
- Metafield limits: https://shopify.dev/docs/apps/build/metafields/metafield-limits

Relevant findings:

- `list.metaobject_reference` stores references to entries from one metaobject definition.
- List values are stored as JSON arrays.
- List metaobject references support up to 1024 items, far above our pathway sizes.
- Reference values use Shopify GIDs, so the import must resolve lesson handles to lesson GIDs before writing pathway lists.

## Definition

- Metaobject type: `learning_pathway`
- Display name field: `title`
- Admin access: merchant read/write
- Storefront access: public read
- Capabilities:
  - `publishable`: enabled
  - `renderable`: enabled if pathway pages are indexed
  - `onlineStore`: enabled if pathway pages are metaobject pages
- Suggested Online Store URL handle: `learn-pathway`
- Resulting pathway URL pattern: `/pages/learn-pathway/{pathway-handle}`

## Proposed Fields

| Admin label | Field key | Shopify field type | Required | Public/admin | Purpose | Example | Render on page | Automated import |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Title | `title` | `single_line_text_field` | Required | Public | Pathway name | `Start Here` | Yes | Yes |
| Short description | `short_description` | `multi_line_text_field` | Required | Public | Card summary and page intro | `A short beginner onboarding path.` | Yes | Yes |
| Icon or image | `icon_image` | `file_reference` | Optional | Public | Pathway visual | Start Here image/icon | Yes | Yes, when asset exists |
| Ordered lessons | `ordered_lessons` | `list.metaobject_reference<learning_lesson>` | Required for active pathways | Public | Preserves the deliberate lesson sequence | R07, R08, R01, R10, R14, R17 | Yes | Yes |
| Pathway status | `pathway_status` | `single_line_text_field` | Required | Admin/public | Distinguishes current vs future pathway | `current`, `future expansion` | Optional | Yes |
| Estimated total minutes | `estimated_total_minutes` | `number_integer` | Optional | Public/admin | Sum of lesson reading times for the route | `20` | Yes | Yes |
| Downloadable resources | `downloadable_resources` | `list.file_reference` | Optional | Public | Pathway-level PDF or checklist | Start Here PDF | Yes | Yes, when file GIDs resolve |
| Reward or quiz note | `reward_quiz_note` | `multi_line_text_field` | Optional | Admin | Placeholder for later quiz/reward planning | `No reward at launch` | No | Yes |
| SEO title | `seo_title` | `single_line_text_field` | Optional | SEO/admin | Pathway SEO title | `Start Here Snorkeling Lessons | Oceans Optics` | Head metadata only | Yes |
| Meta description | `meta_description` | `multi_line_text_field` | Optional | SEO/admin | Pathway SEO description | Pathway summary | Head metadata only | Yes |

## Preserving Lesson Order

The approved pathway order should live in Git first, then sync into Shopify:

1. Parse the pathway source from `planning/learning-hub-architecture-v2/04-REVISED-LEARNING-PATHWAYS.md` or normalized repository data.
2. Resolve each lesson handle to a Shopify `learning_lesson` GID.
3. Write `ordered_lessons` as a `list.metaobject_reference<learning_lesson>` value in that exact order.
4. Render the list in the theme without sorting it alphabetically.
5. Add validation that the rendered order matches the repository order for the pilot pathways.

Example for Start Here:

1. `R07 Health, Readiness and Personal Responsibility`
2. `R08 Golden Rules for Safer Snorkeling`
3. `R01 Choosing a Mask`
4. `R10 Pre-Snorkel Checklist and Planning`
5. `R14 Buddy Communication and Awareness`
6. `R17 Entry and Exit Techniques`

## Lesson-to-Pathway Duplication

`learning_lesson.pathways` is useful for badges and lesson-page context, but `learning_pathway.ordered_lessons` is the canonical sequence.

Rule:

- Pathway sequence belongs to `learning_pathway.ordered_lessons`.
- Lesson pathway membership can be derived during import and written to `learning_lesson.pathways`.
- Editors should not manually maintain both in Shopify.

## Future Quiz and Reward Notes

Do not create quiz metaobjects now. Keep `reward_quiz_note` administrative only. Add quiz/progress architecture only after the content pages and pathway browsing work.

