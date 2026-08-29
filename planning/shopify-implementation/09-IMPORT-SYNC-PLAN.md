# Import and Sync Plan

## Recommendation

Build a controlled import pipeline from repository content into Shopify metaobjects. The first version should support dry runs, validation, deterministic handles, and non-destructive updates.

No Shopify connection or API execution belongs in this planning stage.

## Official Shopify Docs Checked

- Manage metaobject definitions: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions
- Manage metaobject entries: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobjects
- `metaobjectUpsert`: https://shopify.dev/docs/api/admin-graphql/latest/mutations/metaobjectUpsert
- `fileCreate`: https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate
- `stagedUploadsCreate`: https://shopify.dev/docs/api/admin-graphql/latest/mutations/stagedUploadsCreate
- Shopify API limits: https://shopify.dev/docs/api/usage/limits
- Metafield limits: https://shopify.dev/docs/apps/build/metafields/metafield-limits

Relevant findings:

- Metaobject definitions and entries can be created and updated through Admin GraphQL.
- `metaobjectUpsert` can create or update an entry based on its handle.
- The `values` argument to `metaobjectUpsert` is a full replacement and omitted keys are cleared.
- The `metaobject` input form can patch fields while preserving unlisted fields.
- `fileCreate` adds files to Shopify Files and supports PDFs as generic files.
- `fileCreate` processes files asynchronously and allows up to 250 files per batch.
- Admin GraphQL is rate-limited by calculated query cost.

## Source Flow

1. Read approved architecture from `planning/learning-hub-architecture-v2/`.
2. Read lesson schema and approved lesson drafts from `content-development/`.
3. Normalize Markdown into JSON records.
4. Validate required fields, review gates, handles, relationships, and public-field cleanliness.
5. Resolve media, downloads, products, categories, pathways, and related lessons.
6. Generate an import plan.
7. Run a dry-run report.
8. Apply updates only after review.

## Normalized Data Shape

Create an intermediate JSON representation before touching Shopify:

- `categories`
- `pathways`
- `lessons`
- `files`
- `product_links`
- `validation_errors`
- `warnings`

This makes the import auditable and avoids mixing Markdown parsing with Shopify mutations.

## Definition Setup

Because the `onlineStore` capability is not fully supported in TOML, create or update the three metaobject definitions through Admin GraphQL when implementation begins:

- `learning_lesson`
- `learning_category`
- `learning_pathway`

Definition changes should be reviewed carefully. Deleting definitions is destructive because it can delete related data.

## Entry Sync Order

Use this order:

1. Ensure definitions exist.
2. Create or update category entries.
3. Create or update pathway shells without `ordered_lessons`.
4. Create or update lesson entries with category references.
5. Resolve lesson GIDs by type and handle.
6. Update `related_lessons` on lessons.
7. Update `ordered_lessons` on pathways.
8. Derive and update `learning_lesson.pathways`.
9. Upload or resolve downloadable resources.
10. Re-run validation against Shopify IDs.

The two-pass relationship update avoids needing references before entries exist.

## Handles and Identity

Shopify identity should be deterministic:

- type: `learning_lesson`, `learning_category`, or `learning_pathway`
- handle: repository slug
- display title: public title
- internal join key: `lesson_id` for lessons

Do not create new handles for existing records unless a deliberate redirect/migration is approved.

## Upsert Strategy

Use `metaobjectUpsert` by handle for routine entry sync.

Recommended first implementation:

- Use the `metaobject` input form with a `fields` array for patch-style updates.
- Avoid `values` for partial updates because omitted keys are cleared.
- In a fully managed import later, `values` can be used only if every managed field is always supplied.

Do not delete Shopify entries automatically. If a lesson is removed from the approved architecture, set it to `DRAFT` and report it for manual review.

## File Sync

For PDFs and other downloads:

1. Generate or select the final file outside Shopify.
2. Upload through `fileCreate`.
3. Use `stagedUploadsCreate` first when needed for local or large uploads.
4. Wait for `fileStatus` to be ready.
5. Store returned file GIDs in `downloadable_resources`.

For images:

- Use `file_reference` for hero/category/pathway images.
- Keep alt text in the normalized import data or in a future explicit field if the theme cannot source it cleanly.

## Product References

Resolve products by handle before writing `list.product_reference`.

Rules:

- If a product handle cannot be resolved, omit the reference and report a warning.
- Do not write placeholder products.
- Product selection should remain editorial, not automatic keyword matching.

## Validation

Dry run should report:

- missing required fields
- duplicate handles
- unknown category/pathway IDs
- unresolved lesson references
- unresolved product handles
- unresolved files
- internal markers in public fields
- lessons blocked by review rules
- pathway order mismatches
- fields that exceed Shopify limits

## Rate Limits and Batching

Keep the launch importer simple:

- batch file uploads at 250 or fewer files
- throttle GraphQL mutations based on returned cost/throttle status
- prefer small, retryable batches
- write a local import report after each run

The 30-lesson launch is small enough that correctness matters more than throughput.

## Drift Management

The import report should flag Shopify entries that differ from Git-managed fields.

Recommended ownership:

- Git source overwrites Git-managed fields.
- Shopify-only media IDs and generated GIDs are recorded in an import mapping file or report.
- Manual Shopify copy changes are treated as drift and must be pulled back into Git before the next managed import.

