# Stage 5A Result

## Summary

Stage 5A local Shopify scaffolding is complete. The work is confined to `/shopify/` and remains local-only.

No Shopify connection, credential request, API mutation, live theme edit, PDF creation, quiz metaobject creation, new lesson drafting, or approved pilot rewrite was performed.

## Metaobject Field Counts

- `learning_lesson`: 22 fields
- `learning_category`: 4 fields
- `learning_pathway`: 4 fields

## URL Architecture

- Learning Hub homepage: `/pages/learn`
- Lesson pages: `/pages/learn/{lesson-handle}`
- Category pages: `/pages/learn-category/{category-handle}`
- Pathway pages: `/pages/learn-pathway/{pathway-handle}`

`learning_lesson` uses `onlineStore.urlHandle = learn`, with `renderable` SEO aliases:

- `seo_title`
- `meta_description`

Category and pathway pages are also specified as renderable Online Store metaobject pages for launch because they improve navigation and SEO without adding unnecessary definitions.

## Pilot Entries Generated

Generated normalized `learning_lesson` JSON:

- `data/lessons/R01-choosing-a-mask.json`
- `data/lessons/R08-golden-rules-for-safer-snorkeling.json`
- `data/lessons/R12-currents-and-rip-currents.json`

Generated normalized supporting data:

- 5 category entries in `data/categories.json`
- 5 current pathway entries in `data/pathways.json`
- approved lesson handle reference index in `data/approved-lesson-handles.json`

The future Prescription Masks & Underwater Vision pathway is technically supported by the schema but is not included in phase-one pathway data.

## Validation Results

Latest dry-run validation:

- Errors: 0
- Warnings: 53
- Info: 3
- Unresolved references: 49
- Blocking validation errors: 0

Expected warnings include:

- future approved lessons referenced by pathways but not normalized yet
- related lessons that point to approved future lesson handles
- unresolved tool URLs
- unresolved product GIDs
- unresolved file GIDs
- unresolved CTA URL for R01
- missing reviewer and `last_reviewed` for R08 and R12

R08 and R12 remain unsuitable for `ACTIVE` publication until required safety/current-guidance review is complete.

## Payload Builder Result

Generated local payload skeleton:

- `generated/shopify-payloads.json`

It includes:

- 3 `metaobjectDefinitionCreate` payload skeletons
- 5 category `metaobjectUpsert` payload skeletons
- 5 pathway `metaobjectUpsert` payload skeletons
- 3 lesson `metaobjectUpsert` payload skeletons

The builder uses the `metaobject` input form for `metaobjectUpsert`, so provided fields are updated and omitted fields are preserved. It deliberately does not use the `values` argument because Shopify documents `values` as a full replacement that clears omitted fields.

## Dry-Run Commands

Run from `/shopify/`:

```sh
npm run learning:validate
npm run learning:build-payloads
npm run learning:dry-run
```

All three commands completed successfully with no network requests.

## Unresolved Implementation Questions

- Confirm exact live Shopify validation payload details for reference targets when moving from local skeletons to real definition mutations.
- Decide final public URLs or Shopify GIDs for tools, products, downloads, and CTAs before including those fields in live payloads.
- Assign approved human reviewer values and `last_reviewed` dates before any safety/current-guidance lesson becomes `ACTIVE`.
- Decide which optional hero/category/pathway images will be uploaded to Shopify Files before launch.

## Change Before Connecting to Shopify

Before a real Shopify connection:

1. Resolve or intentionally omit all tool/product/file/CTA references.
2. Add human reviewer and review dates for safety/current-guidance lessons intended for `ACTIVE`.
3. Confirm the target store has no `/pages/learn` URL conflict with the planned metaobject URL namespace.
4. Replace local resolver tokens with actual Shopify GID resolution in the live sync step.

