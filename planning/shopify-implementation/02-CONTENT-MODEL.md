# Content Model: Rich Text vs Modular Content

## Recommendation

Use a simple hybrid:

- one main `lesson_body` rich-text field for the main lesson
- structured fields for high-value reusable components
- no child metaobjects for every section or paragraph
- no quiz metaobjects at launch

This gives the Learning Hub enough structure to render consistent pages without turning normal article editing into database modeling.

## Official Shopify Docs Checked

- Metafield/metaobject data types: https://shopify.dev/docs/apps/build/metafields/list-of-data-types
- Metaobject limits: https://shopify.dev/docs/apps/build/metaobjects/metaobject-limits
- JSON templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates
- Metaobject templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject

Relevant findings:

- `rich_text_field` supports headings, lists, links, bold, and italics.
- `rich_text_field` does not support a list type.
- Reference types and list reference types are native.
- JSON templates can render sections in defined order, but adding too many template sections creates theme complexity.

## Option A: One Main Rich-Text Field Plus Structured Supporting Fields

Description: Store the public lesson body in `lesson_body`, then store related lessons, products, downloads, key takeaways, and optional blocks separately.

Strengths:

- Best fit for the 30-lesson launch.
- Easier automated import from Markdown.
- Easy for theme developers to render.
- Keeps lesson pages mobile-friendly if the Markdown-to-rich-text conversion is clean.
- Avoids many child objects and reference resolution problems.
- Leaves room under the 40-field limit.

Weaknesses:

- Less granular content reuse.
- Inline images/diagrams inside the main body may need careful handling.
- Theme cannot easily reorder every lesson section in Admin.
- Knowledge checks are less structured unless stored in a separate JSON field or future quiz model.

Best use:

- Launch version.

## Option B: Fully Modular Lesson Sections

Description: Model each lesson section as a separate metaobject or block: paragraphs, callouts, steps, quiz blocks, media blocks, tips, mistakes, and takeaways.

Strengths:

- Highly flexible rendering.
- Reusable content sections are possible.
- Better if lessons become interactive courses with many reusable components.
- Stronger control over per-section media.

Weaknesses:

- Much harder to import.
- More definitions and reference resolution.
- More failure points in Admin editing.
- Overkill for 30 mostly educational lessons.
- Harder to maintain without a custom editorial interface.
- Turns content writing into data entry.

Best use:

- Future interactive course system, not launch.

## Option C: Simple Hybrid

Description: Store the main article body as rich text, but keep important repeated page components in structured fields.

Recommended structured fields:

- `key_takeaways` as `list.single_line_text_field`
- `instructor_tips` as `rich_text_field`
- `common_mistakes` as `rich_text_field`
- `safety_notes` as `rich_text_field`
- `related_lessons` as `list.metaobject_reference<learning_lesson>`
- `related_tools` as `list.link`
- `related_products` as `list.product_reference`
- `downloadable_resources` as `list.file_reference`
- `primary_cta` as `link`

Why this wins:

- The main lesson stays easy to write and import.
- The components that matter for page layout, merchandising, and navigation remain structured.
- The theme can render consistent cards, callouts, downloads, and related content.
- It is easier to evolve into a quiz/metaobject system later.

## Evaluation

| Concern | Option A | Option B | Option C |
| --- | --- | --- | --- |
| Editing experience | Simple | Heavy | Simple with useful controls |
| Mobile rendering | Good if rich text is clean | Strong but complex | Strong |
| SEO | Good | Good | Good |
| Maintainability | Good | Weak at launch | Best launch fit |
| Complexity | Low | High | Moderate-low |
| Automated importing | Straightforward | Difficult | Straightforward |
| Quizzes | Embedded only | Fully structured | Embedded now, structured later |
| Instructor tips | Can be in body | Fully modular | Separate optional field |
| Safety notes | Can be in body | Fully modular | Separate optional field |
| Images/diagrams | Hero plus body | Fully modular | Hero plus body/download fields |
| Future flexibility | Moderate | High | Good |

## Launch Recommendation

Use Option C.

Implementation shape:

1. Convert the public Markdown lesson draft into one `lesson_body` rich-text value.
2. Keep repeated optional components as separate fields only when they need distinctive rendering or linking.
3. Store knowledge checks inside `lesson_body` for launch.
4. Keep the structured Markdown knowledge-check format in Git so it can later feed quiz metaobjects.
5. Attach downloadable PDFs through `downloadable_resources` only after files exist in Shopify Files.
6. Do not split every heading or paragraph into metaobjects.

## Notes on Images and Diagrams

Use `hero_media` for the primary asset. For diagrams inside the lesson body, either:

- include them in `lesson_body` if the rich-text conversion supports the asset cleanly, or
- add a future `supporting_media` field only after the first three pilot pages prove the need.

Do not add a modular image-gallery system at launch unless the first pilot template cannot render diagrams well.

