# URL and SEO Architecture

## Recommendation

Use Shopify metaobject Online Store pages for lesson, category, and pathway detail pages. Use a normal Shopify page for the Learning Hub homepage.

The proposed lesson URL `/pages/learn/{lesson-handle}` is achievable with Shopify's `onlineStore` metaobject capability by setting the `learning_lesson` URL handle to `learn`.

## Official Shopify Docs Checked

- Metaobject capabilities: https://shopify.dev/docs/apps/build/metaobjects/use-metaobject-capabilities
- Metaobject theme templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject
- Theme templates: https://shopify.dev/docs/storefronts/themes/architecture/templates
- SEO metadata: https://shopify.dev/docs/storefronts/themes/seo/metadata
- `canonical_url` Liquid object: https://shopify.dev/docs/api/liquid/objects/canonical_url

Relevant findings:

- `onlineStore` assigns a URL handle and theme template to a metaobject definition.
- Shopify's documented URL pattern for online-store metaobjects is `/pages/{urlHandle}/{entry-handle}`.
- `renderable` adds SEO metadata support and includes metaobjects in the sitemap.
- Metaobject templates live at `templates/metaobject/{type}.json`.
- Theme head markup should output title, meta description, and canonical URL.

## URL Structure

| Surface | Shopify object | URL pattern | Notes |
| --- | --- | --- | --- |
| Learning Hub homepage | Shopify page with a custom page template | `/pages/learn` | Main hub, not a metaobject entry |
| Lesson detail | `learning_lesson` metaobject | `/pages/learn/{lesson-handle}` | Uses `onlineStore.urlHandle = learn` |
| Category detail | `learning_category` metaobject | `/pages/learn-category/{category-handle}` | Keeps category pages shallow |
| Pathway detail | `learning_pathway` metaobject | `/pages/learn-pathway/{pathway-handle}` | Keeps sequence pages separate from lessons |
| Future prescription pathway | `learning_pathway` metaobject | `/pages/learn-pathway/prescription-masks-underwater-vision` | Create only when content is ready |

This avoids nested custom paths that Shopify metaobject URL handles are not designed to guarantee.

## Lesson URL Requirement

Question: can lessons live at `/pages/learn/{lesson-handle}`?

Answer: yes, if all of the following are true:

1. The `learning_lesson` metaobject definition has `onlineStore` enabled.
2. The definition uses `learn` as its Online Store URL handle.
3. The lesson entry handle matches the repository slug.
4. The entry is `ACTIVE` under the `publishable` capability.
5. A metaobject template exists for `learning_lesson`.

The Learning Hub homepage at `/pages/learn` should be created as a regular Shopify page. Before implementation, verify there is no URL conflict between that page and the metaobject URL namespace in the target theme/store.

## Handle Rules

Use stable repository slugs as Shopify metaobject handles.

Rules:

- Do not include the lesson ID in the public handle unless it is already part of the approved slug.
- Do not change handles after launch unless a redirect plan exists.
- Keep all handles lowercase and hyphenated.
- Preserve redirects manually or through the theme/app process if a handle must change later.

Examples:

| Lesson ID | Title | Handle | URL |
| --- | --- | --- | --- |
| R01 | Choosing a Mask | `choosing-a-mask` | `/pages/learn/choosing-a-mask` |
| R08 | Golden Rules for Safer Snorkeling | `golden-rules-for-safer-snorkeling` | `/pages/learn/golden-rules-for-safer-snorkeling` |
| R12 | Currents and Rip Currents | `currents-and-rip-currents` | `/pages/learn/currents-and-rip-currents` |

## SEO Fields

Map renderable SEO metadata to fields already defined on each public metaobject:

- `seo_title`
- `meta_description`

For lessons, use:

- Default title fallback: `{lesson title} | Oceans Optics Learning Hub`
- Default meta description fallback: `short_description`
- Canonical URL: Shopify's `canonical_url` value in theme head markup

The theme should not expose admin-only fields in metadata, structured data, JSON-LD, HTML comments, or data attributes.

## Indexing

Recommended launch setting:

- Index approved, active lessons.
- Index approved, active category pages.
- Index approved, active current pathways.
- Keep future pathways in `DRAFT` until their lesson set is ready.

Because Shopify's `renderable` capability can include metaobjects in the sitemap, only publish entries that are truly ready for search traffic.

## Breadcrumbs

Use simple breadcrumbs:

- Home
- Learn
- Category or Pathway
- Lesson

Lesson pages can prefer the primary category breadcrumb. If a visitor arrives from a pathway, the pathway context can be shown in-page rather than changing canonical breadcrumbs.

## PDF and Download Architecture

Use Shopify Files for downloadable PDFs, worksheets, and checklists. Attach them to lessons or pathways through `list.file_reference` fields:

- `learning_lesson.downloadable_resources`
- `learning_pathway.downloadable_resources`

Do not generate PDFs inside Shopify during launch. Generate PDFs from the repository source, upload the final files to Shopify Files, then store the returned file GIDs in the relevant file-reference fields.

Download page behavior:

- Show public title, file type, and size when available.
- Do not expose internal file names if they include draft or source identifiers.
- Do not attach unresolved download placeholders to Shopify entries.

## SEO QA Checklist

Before launch, verify:

- `/pages/learn` loads the hub homepage.
- Each pilot lesson resolves at `/pages/learn/{lesson-handle}`.
- Draft entries do not render publicly.
- Page title and meta description use the intended fields.
- Canonical URL is present.
- Metaobject pages appear in sitemap only after publication.
- Internal review notes are absent from page HTML.
- Category and pathway pages use distinct URL namespaces.

