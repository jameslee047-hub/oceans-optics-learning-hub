# Theme Architecture

## Recommendation

Build a small set of Learning Hub templates, sections, and snippets that render the three planned metaobject types plus the hub homepage. Keep rendering logic simple and reusable, with Git and import validation handling most data consistency.

No live theme changes should happen during this planning stage.

## Official Shopify Docs Checked

- Metaobject theme templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject
- Theme templates: https://shopify.dev/docs/storefronts/themes/architecture/templates
- JSON templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates
- Liquid metaobject object: https://shopify.dev/docs/api/liquid/objects/metaobject
- Liquid metaobjects object: https://shopify.dev/docs/api/liquid/objects/metaobjects
- SEO metadata: https://shopify.dev/docs/storefronts/themes/seo/metadata

Relevant findings:

- Metaobject templates use the path `templates/metaobject/{type}.json`.
- In a metaobject template context, the `metaobject` Liquid object represents the current entry.
- Store metaobjects can also be accessed through the `metaobjects` Liquid object.
- JSON templates render sections in the order declared by the template.
- Shopify documents a limit of 25 sections per JSON template and 50 blocks per section.

## Proposed Theme Files

| File | Purpose |
| --- | --- |
| `templates/page.learning-hub.json` | Learning Hub homepage template for `/pages/learn` |
| `sections/learning-hub.liquid` | Hub landing view with categories, pathways, and selected lessons |
| `templates/metaobject/learning_lesson.json` | Lesson detail template |
| `sections/learning-lesson.liquid` | Main lesson renderer |
| `templates/metaobject/learning_category.json` | Category page template |
| `sections/learning-category.liquid` | Category overview and lesson-card list |
| `templates/metaobject/learning_pathway.json` | Pathway page template |
| `sections/learning-pathway.liquid` | Ordered pathway sequence renderer |
| `snippets/learning-breadcrumbs.liquid` | Shared Learning Hub breadcrumbs |
| `snippets/learning-card.liquid` | Lesson card, category card, and pathway card variants |
| `snippets/learning-downloads.liquid` | File-reference download list |
| `snippets/learning-related-lessons.liquid` | Related lesson cards |
| `snippets/learning-products.liquid` | Related product cards |
| `assets/learning-hub.css` | Learning Hub styles scoped to templates/sections |
| `assets/learning-hub.js` | Optional progressive enhancement only |

The exact file names can be adapted to the theme's existing naming conventions during implementation.

## Hub Homepage

The `/pages/learn` page should feel like the product itself, not a marketing landing page.

Recommended sections:

- learning hub intro
- Start Here pathway
- five category cards
- current pathway cards
- selected pilot lessons or newest approved lessons
- Oceans Optics instructor credibility
- safety reminder or responsible-use note

Data options:

- Hard-code references in section settings for launch, or
- read all active category/pathway metaobjects and sort by `sort_order` or curated fields.

For launch, section settings are acceptable if they reduce Liquid complexity.

## Lesson Page

Render from the current `learning_lesson` metaobject:

- breadcrumbs
- title
- short description
- category badge
- pathway badges
- hero media if present
- estimated reading time
- main lesson body
- instructor tips
- common mistakes
- safety notes
- key takeaways
- knowledge check content
- downloads
- related lessons
- related products
- primary CTA
- next lesson or pathway progression

Rules:

- Do not render administrative fields.
- Do not render empty sections.
- Respect `publishable` status so draft entries are not visible.
- Avoid Liquid logic that assumes every optional field exists.

## Category Page

Render from the current `learning_category` metaobject:

- title
- short description
- optional intro content
- lesson cards for active lessons with matching `category`

For 30 launch lessons, iterating active lessons in Liquid should be acceptable. If this becomes awkward in the real theme, add a derived `category_lessons` list during import.

## Pathway Page

Render from the current `learning_pathway` metaobject:

- title
- short description
- estimated total minutes
- ordered lesson list from `ordered_lessons`
- pathway downloads
- future quiz/reward note only if intentionally public later

The theme should render the `ordered_lessons` references in the order returned by the list field. Do not sort them by title or ID.

## Related Lessons

Use `learning_lesson.related_lessons` as the primary source.

Fallback logic, if the field is empty:

- show lessons from the same category, or
- show the next lesson in a shared pathway if available.

Fallbacks should be conservative to avoid strange loops or irrelevant cards.

## Accessibility and Mobile QA

Check:

- heading order
- readable tap targets
- keyboard access for any interactive knowledge-check styling
- image alt text
- cards that do not rely only on color
- no overflow in titles or badges
- downloads announced as links
- related product cards that remain optional

## Theme Implementation Safety

Implementation should happen in this order:

1. Duplicate or unpublished theme.
2. Pilot-only test entries in `DRAFT` first.
3. Preview templates against pilot entries.
4. Activate pilot entries only after SEO and content QA.
5. Roll out to the full lesson set after the pilot pages are stable.
