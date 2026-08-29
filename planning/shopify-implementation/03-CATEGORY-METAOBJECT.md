# Learning Category Metaobject

## Recommendation

Create a `learning_category` metaobject for the five permanent Learning Hub categories. Lessons should reference their primary category. Categories should not maintain a manual list of every lesson for launch.

## Current Categories

- Gear, Masks & Vision
- Safety & Conditions
- In-Water Skills
- Underwater Science & Your Body
- Marine Life & Conservation

## Official Shopify Docs Checked

- Metaobject definitions: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions
- Data modeling with metaobjects/references: https://shopify.dev/docs/apps/build/metaobjects/data-modeling-with-metafields-and-metaobjects
- Metafield/metaobject data types: https://shopify.dev/docs/apps/build/metafields/list-of-data-types
- Liquid metaobjects: https://shopify.dev/docs/api/liquid/objects/metaobjects
- Metaobject templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject

## Definition

- Metaobject type: `learning_category`
- Display name field: `title`
- Admin access: merchant read/write
- Storefront access: public read
- Capabilities:
  - `publishable`: enabled
  - `renderable`: enabled if category pages are indexed
  - `onlineStore`: enabled if category pages are metaobject pages
- Suggested Online Store URL handle: `learn-category`
- Resulting category URL pattern: `/pages/learn-category/{category-handle}`

## Proposed Fields

| Admin label | Field key | Shopify field type | Required | Public/admin | Purpose | Example | Render on page | Automated import |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Title | `title` | `single_line_text_field` | Required | Public | Category name | `Gear, Masks & Vision` | Yes | Yes |
| Short description | `short_description` | `multi_line_text_field` | Required | Public | Category card and page intro | `Masks, snorkels, fins, exposure protection, and underwater vision.` | Yes | Yes |
| Icon or image | `icon_image` | `file_reference` | Optional | Public | Category visual | Mask icon/image | Yes | Yes, when asset exists |
| Sort order | `sort_order` | `number_integer` | Required | Admin/rendering | Controls category display order | `1` | No direct display | Yes |
| Intro content | `intro_content` | `rich_text_field` | Optional | Public | Optional category page introduction | Short overview for Safety & Conditions | Yes | Yes |
| SEO title | `seo_title` | `single_line_text_field` | Optional | SEO/admin | Category SEO title | `Snorkeling Gear, Masks & Vision | Oceans Optics` | Head metadata only | Yes |
| Meta description | `meta_description` | `multi_line_text_field` | Optional | SEO/admin | Category SEO description | Category summary | Head metadata only | Yes |

## Relationship Direction

### Option A: Categories contain lesson-reference lists

This gives category entries direct control over which lessons appear, but it duplicates data already on each lesson and creates another list to maintain.

Not recommended for launch.

### Option B: Lessons reference their primary category

Each `learning_lesson` has a required `category` reference to one `learning_category`.

Recommended for launch.

Benefits:

- One canonical category assignment per lesson.
- Easy import validation.
- Avoids duplicated relationship data.
- Matches the content architecture: every lesson has exactly one primary category.

### Option C: Both directions

Useful only if category pages need a hand-picked ordered curriculum separate from pathways.

Not needed for launch.

## Category Page Retrieval

For 30 lessons, the simplest theme approach is:

1. Load the active `learning_category` metaobject for the page.
2. Iterate active `learning_lesson` entries.
3. Compare each lesson's `category` reference to the current category.
4. Render matching lessons as cards.
5. Sort by `lesson_id`, a future lesson `sort_order`, or an import-generated display order.

If filtering in Liquid becomes awkward or slow later, add a derived `category_lessons` list to `learning_category` during import. Do not start there.

## Category Hub URL

Use `/pages/learn` as the main Learning Hub homepage. Category cards can link to:

- `/pages/learn-category/gear-masks-vision`
- `/pages/learn-category/safety-conditions`
- `/pages/learn-category/in-water-skills`
- `/pages/learn-category/underwater-science-your-body`
- `/pages/learn-category/marine-life-conservation`

This is shallow, predictable, and avoids assuming Shopify supports nested custom paths inside `urlHandle`.

