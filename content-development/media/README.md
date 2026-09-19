# Learning Hub Inline Media

**Status: LOCAL DEVELOPMENT FIXTURE / FALLBACK ONLY.** `learning-media.json` in
this folder is not canonical production authoring and must never become
something the store editor has to hand-maintain. It exists so lessons without
a live Shopify media record can still preview correctly. See
"Production Authoring Model" below.

## The `[MEDIA: key]` directive

Inline lesson media is placed in public lesson copy with a standalone marker,
on its own line, exactly where the visual should appear:

```md
[MEDIA: stable-media-key]
```

The generator preserves that source position -- the block renders in place,
never collected into a separate gallery/footer section. `key` is a stable,
content-addressed identifier (e.g. `single-lens-vs-dual-lens`); the copy never
needs to know whether that key resolves to a static image, a two-image
comparison, a diagram, an animated GIF, a looping video, or a gallery. Do not
place raw HTML, `<img>` tags, or CDN URLs in `public-copy.md`.

`[IMAGE: key]` was an earlier, narrower name for this same directive. It has
been fully replaced by `[MEDIA: key]` -- `[IMAGE:]` never made it into any
approved lesson copy, so this was a clean rename, not a dual-syntax migration.
A stray `[IMAGE:]` marker is now flagged as an error by
`npm run learning:validate` rather than silently accepted.

## Production Authoring Model

The permanent editor experience is two Shopify metaobjects, not this JSON
file:

- **`learning_media`** -- one record per `[MEDIA: key]` block. Fields:
  `media_key`, `layout`, `overall_caption`, `media_items` (ordered list of
  `learning_media_item` references).
- **`learning_media_item`** -- one record per individual visual inside a
  block. Fields: `media` (Shopify file reference), `media_type`, `label`,
  `alt_text`, `caption`, `credit_source`.

See `## Shopify Metaobject Schema` below for exact field types.

**Copy controls WHERE. Shopify Admin controls WHAT.** The lesson body only
ever names a key and a position; everything about the visual itself -- which
file, what layout, alt text, captions, credit -- lives in the attached
`learning_media` record(s) on that `learning_lesson`.

Until those metaobjects exist for a given key, the local dev preview resolves
`[MEDIA: key]` against this JSON file instead, so the Learning Hub renderer
and validator have something to test against. The two are read through the
same shape (`normalizeMediaItem` / `resolveLearningMediaMarker` in
`shopify/scripts/lib/learning-data.js`) so swapping the fixture for a real
metaobject-backed lookup later is a data-source change, not a rendering
rewrite.

## Local fixture record shape

```json
{
  "schema_version": 2,
  "media": {
    "media-key": {
      "layout": "standard",
      "overall_caption": "Optional caption for the whole block.",
      "items": [
        {
          "url": "https://cdn.shopify.com/example/file.jpg",
          "shopify_file_gid": null,
          "media_type": "image",
          "alt": "Required alt text for this specific item",
          "width": 1200,
          "height": 800,
          "label": "Optional per-item label",
          "caption": "Optional per-item caption",
          "credit_source": "Optional per-item credit/source line"
        }
      ]
    }
  }
}
```

Field notes:

- `layout` (required): one of `standard`, `comparison`, `diagram`, `animated`,
  `gallery`. See "Layouts" below.
- `overall_caption` (optional): caption for the whole block, e.g. "Single-lens
  and dual-lens masks differ in how the front glass is divided." Distinct from
  a per-item `caption` -- do not conflate a shared block caption with an
  individual image's own caption.
- Each item needs real image data before its `[MEDIA:]` block can be used in
  approved copy:
  - `url` or `shopify_file_gid` (one of these, required)
  - `alt` (required for every meaningful visual image; a `media_type: "video"`
    item may omit `alt` since it needs no `<img>` alt text, but should still
    carry an accessible label some other way -- see "GIF / Video Handling")
  - `width` and `height`, or `aspect_ratio`
- `media_type` (optional, defaults to `image`): `image`, `animated` (GIF), or
  `video`. Purely descriptive for a still image/GIF (both render as `<img>`);
  it changes rendering only for `video`, which renders as a muted, looping,
  inline `<video>` instead. See "GIF / Video Handling."
- `label`, `caption`, `credit_source` (all optional, all per-item): a
  comparison with two images gets two independent alt texts, two independent
  captions, and two independent credit lines -- never one shared field for
  both sides.

## Layouts

- **`standard`** -- normally one media item. One responsive educational image,
  GIF, or video.
- **`comparison`** -- typically two items, side-by-side on desktop and
  stacked on mobile. Each item keeps its own label/alt/caption/credit.
- **`diagram`** -- typically one wider annotated or instructional item
  (16:9 by default instead of the standard 4:3).
- **`animated`** -- a looping visual, GIF today or an optimized video later.
  Same single-item layout shape as `standard`/`diagram`; the distinct layout
  name exists so the block can get its own visual treatment (e.g. an
  "Animated" affordance) independent of `media_type`.
- **`gallery`** -- an arbitrary ordered list of items in a responsive grid.
  Item count is never hard-coded to 1 or 2.

## GIF / Video Handling

No real files are converted or added by this architecture pass -- this
section documents the migration path for when that happens.

A `media_type: "animated"` (GIF) item and a `media_type: "video"` item are
interchangeable from the copy's point of view: swapping one for the other
never touches `[MEDIA: key]`, the lesson body, or the surrounding layout.
Only the `learning_media_item` record changes (`media_type` + the file
reference).

Rendering rules already implemented in
`theme/learning-hub-pilot/assets/learning-hub-inline-media.js` and
`shopify/scripts/generate-preview-fixture.js`:

- A GIF needs no player -- it's just an `<img>`, so `media_type: "animated"`
  (or the default `"image"`) renders exactly like a static photo.
- A `media_type: "video"` item renders as `<video muted loop playsinline
  preload="metadata">`, no native controls, sized from `width`/`height` or
  `aspect_ratio` like any other item.
- **`prefers-reduced-motion` is honored at the JS layer, not attribute-level
  `autoplay`:** the video markup omits `autoplay`; a shared runtime check
  plays it only when `window.matchMedia('(prefers-reduced-motion: reduce)')`
  is false, otherwise it sits on its first frame like a still image. This
  keeps the static HTML/Liquid output correct even before JS runs, and keeps
  the reduced-motion decision in one place instead of duplicated per-page.
- **Accessible description:** an `<img>` item's `alt` does this job directly.
  A `video` item has no native alt attribute, so its accessible label is
  carried via `aria-label` (sourced from the same `alt` field on that item) --
  author it as you would alt text, describing what the loop shows.
- Do not overbuild this further until a real video file/host is chosen --
  captions/subtitles, poster frames, and Shopify's specific video file
  reference shape are one-file real-world problems, not architecture-level
  ones, and can be added to `learning_media_item` when they're needed.

## Reserved R01 keys (not yet wired)

These keys are reserved for the "Choosing a Mask" audits but are **not**
inserted into `content-development/lessons/R01-choosing-a-mask/public-copy.md`
yet, and have no registry/metaobject records yet. Real assets are chosen and
wired in a separate pass.

| Key | Intended layout | Intended position |
| --- | --- | --- |
| `single-lens-vs-dual-lens` | `comparison` | "Single-Lens vs. Dual-Lens Masks" section |
| `clear-vs-dark-skirt` | `comparison` | "Clear Skirt vs. Dark or Black Skirt" section |
| `mask-fit-seal` | `diagram` | "Fit and Seal Matter Most" section |

## Editor Workflow (once Shopify metaobjects exist)

1. In `public-copy.md`, put the marker exactly where the visual should
   appear:

   ```md
   [MEDIA: single-lens-vs-dual-lens]
   ```

2. In Shopify Admin, create (or open) the matching Learning Media record:

   `media_key: single-lens-vs-dual-lens`

3. Choose a `layout`, e.g. `comparison`.

4. Add the ordered Learning Media Items. Each one gets its own image/file,
   label, alt text, caption, and optional credit/source -- never one shared
   alt text for the whole comparison.

5. Attach the `learning_media` record to the lesson (`learning_lesson ->
   media` reference list).

6. Save. The Learning Hub renders the block at the exact `[MEDIA:]` location
   -- the editor never pastes a CDN URL into `public-copy.md`.

## Shopify Metaobject Schema

Not created in Shopify yet -- see `## Ready to Create Shopify Metaobjects?`
in the accompanying task report. Proposed local schema (matching the format
already used for `learning_lesson`/`learning_category`/`learning_pathway` in
`shopify/schema/definitions.json`):

### `learning_media`

| Field key | Name | Type | Required |
| --- | --- | --- | --- |
| `media_key` | Media key | `single_line_text_field` | Yes |
| `layout` | Layout | `single_line_text_field` (validated: `standard`, `comparison`, `diagram`, `animated`, `gallery`) | Yes |
| `overall_caption` | Overall caption | `multi_line_text_field` | No |
| `media_items` | Media items | `list.metaobject_reference` -> `learning_media_item` | Yes |
| `width_treatment` | Width / span treatment | `single_line_text_field` (validated: e.g. `contained`, `full`) | No |
| `internal_editor_note` | Internal editor note | `multi_line_text_field` | No -- **never rendered publicly** |

### `learning_media_item`

| Field key | Name | Type | Required |
| --- | --- | --- | --- |
| `media` | Media file | `file_reference` (image or video/GIF file) | Yes |
| `media_type` | Media type | `single_line_text_field` (validated: `image`, `animated`, `video`) | No |
| `label` | Label | `single_line_text_field` | No |
| `alt_text` | Alt text | `single_line_text_field` | Yes (for any meaningful visual image) |
| `caption` | Caption | `multi_line_text_field` | No |
| `credit_source` | Credit / source | `single_line_text_field` | No |

Both definitions would use `access: { storefront: "PUBLIC_READ" }` with no
`publishable`/`renderable`/`onlineStore` capability -- they are structured
content blocks a lesson references, not standalone pages with their own URL.

### A technically cleaner Shopify-native option, and why this design is kept anyway

Shopify's `rich_text_field` (used for `lesson_body`) supports a native
`image` node type. For a `standard`/`diagram`/`animated` block with exactly
one item, the cleanest Shopify-native approach would be to resolve
`[MEDIA: key]` at Shopify-payload build time (in `markdownToShopifyRichText`)
directly into that native `image` node, so Liquid's `metafield_tag` renders
it server-side with zero client-side JS. That option is noted here for future
work but not implemented now, because:

- It only covers single-item layouts. `comparison` and `gallery` need a
  custom multi-column layout that a `rich_text_field`'s fixed node schema
  cannot express, so they need the same "leave a marker, resolve outside the
  rich text renderer" approach regardless.
- Building it now would mean two different resolution paths (native rich-text
  node vs. marker-replacement) for what is, from the editor's side, the exact
  same `[MEDIA: key]` directive and the same `learning_media` record shape --
  more surface area for the "standard" case to drift from "comparison"/
  "gallery" behavior.
- The current approach (leave the literal marker text in the rich text
  paragraph, replace it client-side via
  `theme/learning-hub-pilot/assets/learning-hub-inline-media.js` reading
  `window.OOLearningHubMediaRegistry`) already satisfies "copy controls
  WHERE, Shopify Admin controls WHAT" for every layout uniformly, and is a
  small, already-working piece of code.

If a future pass wants the zero-JS native-node version for single-item
layouts specifically, it's an additive change to `markdownToShopifyRichText`
-- it doesn't require redesigning `learning_media`/`learning_media_item` or
changing what an editor does in Shopify Admin.

## Local fixture role (again, explicitly)

`content-development/media/learning-media.json` is a **development fixture /
fallback only**. It exists to let the local JS preview and
`npm run learning:validate` exercise `[MEDIA:]` resolution before any real
Shopify `learning_media` record exists for a given key. It is never the
production source of truth, must never require the store editor to maintain
it by hand once metaobjects are live, and currently contains zero real
records -- every key above is reserved in documentation only.
