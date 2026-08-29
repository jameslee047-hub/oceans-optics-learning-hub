# Learning Lesson Metaobject

## Recommendation

Create a `learning_lesson` metaobject for publication-ready lesson pages. Keep the repository as the rich editorial/source system; Shopify should receive the fields needed to render, organize, review, and maintain live Learning Hub lessons.

Do not import raw extraction notes, source page paths, content gaps, visual briefs, or unresolved review markers into Shopify.

## Official Shopify Docs Checked

- Metaobject capabilities: https://shopify.dev/docs/apps/build/metaobjects/use-metaobject-capabilities
- Metaobject definitions: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions
- Metaobject entries: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobjects
- Metafield/metaobject data types: https://shopify.dev/docs/apps/build/metafields/list-of-data-types
- Metaobject limits: https://shopify.dev/docs/apps/build/metaobjects/metaobject-limits
- Metaobject theme templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject

Key findings:

- Metaobject definitions use metafield data types for their fields.
- `publishable`, `renderable`, and `onlineStore` capabilities should be enabled for lessons.
- `renderable` exposes SEO metadata and contributes metaobjects to the sitemap.
- `onlineStore` can produce `/pages/{urlHandle}/{entry-handle}`.
- Each metaobject definition can currently have up to 40 fields.
- `rich_text_field` has no list counterpart, so repeated rich-text components should either be rich text blocks in one field or future child metaobjects.

## Definition

- Metaobject type: `learning_lesson`
- Display name field: `title`
- Admin access: merchant read/write
- Storefront access: public read
- Capabilities:
  - `publishable`: enabled
  - `renderable`: enabled
  - `onlineStore`: enabled
- Online Store URL handle: `learn`
- Resulting lesson URL pattern: `/pages/learn/{entry-handle}`
- Renderable SEO mapping:
  - Meta title key: `seo_title`
  - Meta description key: `meta_description`

## Proposed Shopify Fields

This proposal uses 26 fields, leaving room under Shopify's current 40-field metaobject definition limit.

| Admin label | Field key | Shopify field type | Required | Public or administrative | Purpose | Example | Render on page | Automated import |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Title | `title` | `single_line_text_field` | Required | Public | Main lesson title and display name | `Choosing a Mask` | Yes | Yes |
| Lesson ID | `lesson_id` | `single_line_text_field` | Required | Administrative | Stable architecture ID from the approved map | `R01` | No | Yes |
| Short description | `short_description` | `multi_line_text_field` | Required for publishable lessons | Public | Card summary and page intro support | `Learn how lens format, skirt color, and vision needs affect mask choice.` | Yes | Yes |
| Lesson type | `lesson_type` | `single_line_text_field` | Required | Public/admin | Supports filtering and template styling | `Equipment guide` | Optional | Yes |
| Primary category | `category` | `metaobject_reference<learning_category>` | Required | Public | Connects each lesson to one permanent category | `Gear, Masks & Vision` | Yes | Yes |
| Learning pathways | `pathways` | `list.metaobject_reference<learning_pathway>` | Optional | Public | Shows pathway membership on lesson pages; derived from repository pathway definitions | `Start Here`, `Equipment Essentials` | Yes | Yes |
| Estimated reading minutes | `estimated_reading_minutes` | `number_integer` | Optional | Public | Simple reading-time display and sorting support | `4` for R01 | Yes | Yes |
| Hero media | `hero_media` | `file_reference` | Optional | Public | Main page image or diagram; validate as image/video when definition is created | R01 mask comparison image | Yes | Yes, when asset exists |
| Lesson body | `lesson_body` | `rich_text_field` | Required | Public | Main lesson content using simple rich text | R12 current types explainer | Yes | Yes |
| Instructor tips | `instructor_tips` | `rich_text_field` | Optional | Public | One or more instructor tips, stored as headings/list/paragraphs | R01 prescription-lens tip | Yes | Yes |
| Common mistakes | `common_mistakes` | `rich_text_field` | Optional | Public | Common beginner mistakes | R08 skipping buddy/condition checks | Yes | Yes |
| Safety notes | `safety_notes` | `rich_text_field` | Optional | Public | Public safety cautions after review | R12 note that the lesson is not emergency-response training | Yes | Yes |
| Key takeaways | `key_takeaways` | `list.single_line_text_field` | Optional | Public | Scannable lesson recap | `Do not snorkel alone.` | Yes | Yes |
| Related lessons | `related_lessons` | `list.metaobject_reference<learning_lesson>` | Optional | Public | Editorially selected next reads | R01 -> R02, R03, R25 | Yes | Yes |
| Related tools | `related_tools` | `list.link` | Optional | Public | Links to live Oceans Optics tools only | Mask sizing tool when live | Yes | Yes, when URL exists |
| Related products | `related_products` | `list.product_reference` | Optional | Public | Product cards directly relevant to the lesson | Prescription mask collection products | Yes | Yes, when product handles resolve |
| Downloadable resources | `downloadable_resources` | `list.file_reference` | Optional | Public | PDFs or other files attached to the lesson | Mask comparison PDF | Yes | Yes, when file GIDs resolve |
| Primary CTA | `primary_cta` | `link` | Optional | Public | One main action where natural | `[CTA: find-your-mask]` becomes a real link later | Yes | Yes, when URL exists |
| Author | `author` | `single_line_text_field` | Optional | Administrative | Tracks who prepared the Shopify-ready entry | `Oceans Optics` or named content owner | No by default | Yes |
| Reviewer | `reviewer` | `single_line_text_field` | Optional before review; required by workflow for safety-tagged ready lessons | Administrative | Named reviewer for safety/current/product review | `Unassigned` or reviewer name | No by default | Yes |
| Last reviewed | `last_reviewed` | `date` | Optional before review; required by workflow before `Ready` for tagged lessons | Administrative, optionally public later | Date factual/editorial review was completed | `2026-09-10` | Optional | Yes |
| Review tags | `review_tags` | `list.single_line_text_field` | Optional | Administrative | Operational flags used by import validation | `safety`, `current guidance` | No | Yes |
| Editorial status | `editorial_status` | `single_line_text_field` | Required | Administrative | Internal workflow state | `Pilot draft`, `Approved`, `Published` | No | Yes |
| Publication readiness | `publication_readiness` | `single_line_text_field` | Required | Administrative | Blocks import/publish decisions | `Blocked by safety review` | No | Yes |
| SEO title | `seo_title` | `single_line_text_field` | Optional but recommended | SEO/admin | Renderable meta title source | `Choosing a Snorkeling Mask | Oceans Optics Learning Hub` | Head metadata only | Yes |
| Meta description | `meta_description` | `multi_line_text_field` | Optional but recommended | SEO/admin | Renderable meta description source | R01 SEO description | Head metadata only | Yes |

## Fields Not Proposed for Shopify

These should remain repository-only:

- Original Genially source IDs
- Source files
- Extraction notes
- Content gaps
- Instructor-input opportunities
- Raw fact-check notes
- Safety-review notes and internal markers
- Current-guidance notes
- Information omitted
- Consolidated duplicate material
- Visual brief
- Visual status
- Source confidence

Reason: these fields are essential for content development but should not be available to theme rendering, accidental public display, or casual Shopify admin editing. Git is better for long-form review notes, provenance, diffs, and editorial history.

## Operational Notes

- The lesson entry handle should come from the repository `Slug` field and remain stable.
- `lesson_id` should be stored in Shopify because it is useful for admin search, debugging imports, and mapping Shopify entries back to the approved architecture.
- `pathways` in `learning_lesson` is derived data. The canonical pathway order should live on `learning_pathway.ordered_lessons`.
- Avoid adding quiz fields to `learning_lesson` at launch. Knowledge checks can remain inside the rich-text lesson body until the quiz system justifies separate data.
- Avoid storing unresolved tool/product/download placeholders in Shopify. Import them only once real URLs, product GIDs, or file GIDs exist.

