# Final Shopify Plan

## Executive Recommendation

Use three public-facing Shopify metaobject definitions:

- `learning_lesson`
- `learning_category`
- `learning_pathway`

Use a simple hybrid content model: rich text for the main lesson, structured fields for navigation, downloads, product references, review status, and SEO.

Keep the repository as the editorial source of truth. Shopify should publish the cleaned, approved storefront version only.

## Official Shopify Sources

- Metaobject capabilities: https://shopify.dev/docs/apps/build/metaobjects/use-metaobject-capabilities
- Metaobject definitions: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions
- Metaobject entries: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobjects
- Metaobject upsert: https://shopify.dev/docs/api/admin-graphql/latest/mutations/metaobjectUpsert
- Metafield and metaobject data types: https://shopify.dev/docs/apps/build/metafields/list-of-data-types
- Metaobject limits: https://shopify.dev/docs/apps/build/metaobjects/metaobject-limits
- Metafield limits: https://shopify.dev/docs/apps/build/metafields/metafield-limits
- Metaobject theme templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject
- JSON templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates
- SEO metadata: https://shopify.dev/docs/storefronts/themes/seo/metadata
- File creation: https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate
- Staged uploads: https://shopify.dev/docs/api/admin-graphql/latest/mutations/stagedUploadsCreate
- Shopify API limits: https://shopify.dev/docs/api/usage/limits

## 1. Which Fields Belong in `learning_lesson`?

Recommended solution: use a selective 26-field `learning_lesson` definition. Public fields include title, short description, lesson type, category, pathways, reading time, hero media, lesson body, tips, mistakes, safety notes, takeaways, related lessons, tools, products, downloads, CTA, and SEO fields. Administrative fields include lesson ID, author, reviewer, last reviewed, review tags, editorial status, and publication readiness.

Why: the lesson page needs enough structure for consistent rendering and import validation, but Shopify should not become a dumping ground for extraction and drafting notes.

Shopify feature/type used: metaobject definition with `single_line_text_field`, `multi_line_text_field`, `rich_text_field`, `number_integer`, `date`, `file_reference`, `list.file_reference`, `metaobject_reference`, `list.metaobject_reference`, `list.product_reference`, `list.link`, and `link`.

Unresolved issue: final field validations should be confirmed during definition setup in the target store.

## 2. Should Lesson Content Use Rich Text, Modular Sections, or a Hybrid?

Recommended solution: use a simple hybrid. Store the main public lesson in one `rich_text_field` called `lesson_body`, with structured fields for repeated components and relationships.

Why: it supports the current 30-lesson editorial workflow without over-modeling every paragraph, heading, tip, or diagram as a separate object.

Shopify feature/type used: `rich_text_field` for the main body, plus structured reference/list fields for cards, downloads, products, and related lessons.

Unresolved issue: inline diagrams should be tested in the pilot theme before deciding whether a later `supporting_media` field is needed.

## 3. How Should Categories Connect to Lessons?

Recommended solution: each lesson references one primary `learning_category`; categories do not keep a manual list of all lessons at launch.

Why: it avoids relationship duplication. Each lesson has exactly one approved primary category, so the lesson reference is the clean canonical assignment.

Shopify feature/type used: `learning_lesson.category` as `metaobject_reference<learning_category>`.

Unresolved issue: if Liquid filtering is awkward in the real theme, add a derived `category_lessons` list during import later.

## 4. How Should Pathways Reference Lessons and Preserve Sequence?

Recommended solution: each pathway stores `ordered_lessons` as `list.metaobject_reference<learning_lesson>`.

Why: the order of references in the list is meaningful and can preserve the approved pathway sequence without duplicating lesson content.

Shopify feature/type used: `learning_pathway.ordered_lessons` as `list.metaobject_reference<learning_lesson>`.

Unresolved issue: the importer must validate that Shopify order matches the repository order before publishing.

## 5. How Should Quizzes Work Now and Later?

Recommended solution: keep launch knowledge checks inside lesson content. Defer `learning_quiz` and `learning_quiz_question` metaobjects until interactive grading, saved progress, rewards, or reporting are actually required.

Why: Shopify metaobjects are content structures, not a complete learner-progress system. Building quizzes now would add complexity before the core Learning Hub is proven.

Shopify feature/type used: launch uses `lesson_body`; future quizzes could use additional metaobject definitions plus separate progress storage.

Unresolved issue: future progress tracking needs a separate privacy, account, data-retention, and reward-policy decision.

## 6. How Do We Achieve `/pages/learn/{handle}`?

Recommended solution: enable `onlineStore` on `learning_lesson` and set the metaobject URL handle to `learn`. Use stable repository slugs as entry handles.

Why: Shopify documents the Online Store metaobject URL pattern as `/pages/{urlHandle}/{entry-handle}`.

Shopify feature/type used: `onlineStore`, `publishable`, `renderable`, and `templates/metaobject/learning_lesson.json`.

Unresolved issue: before implementation, verify there is no store-level URL conflict between the normal `/pages/learn` hub page and the metaobject URL namespace.

## 7. How Should Related Lessons Work?

Recommended solution: use `learning_lesson.related_lessons` as a manual ordered list of lesson references. Allow conservative automatic fallbacks from shared category/pathway only when the field is empty.

Why: editorially chosen related lessons will be more useful than automatic matching for a small safety-and-equipment learning hub.

Shopify feature/type used: `list.metaobject_reference<learning_lesson>`.

Unresolved issue: final related-lesson choices should be reviewed during full content production.

## 8. How Should PDFs and Downloads Attach?

Recommended solution: generate PDFs outside Shopify, upload finished files to Shopify Files, and attach them to lessons or pathways through file-reference lists.

Why: Shopify Files is the natural asset store, while PDF generation belongs in the repository/build workflow rather than the storefront.

Shopify feature/type used: `fileCreate`, optionally `stagedUploadsCreate`, then `list.file_reference` fields on `learning_lesson` and `learning_pathway`.

Unresolved issue: final file naming, PDF design, and which lessons deserve downloads can wait until page rendering is stable.

## 9. Which Internal Fields Stay in Git Versus Shopify?

Recommended solution: Git keeps extraction provenance, source IDs, editorial notes, review discussion, visual briefs, content gaps, unresolved placeholders, and import reports. Shopify gets public content, relationships, media references, SEO fields, and publication-control fields.

Why: Git gives better diffs, review history, and reproducibility. Shopify should stay clean enough that accidental public display of internal notes is unlikely.

Shopify feature/type used: public/admin fields on metaobjects plus `publishable` status.

Unresolved issue: emergency Shopify Admin edits need a rule: copy them back into Git before the next sync.

## 10. How Do We Import and Update All Lessons Without Manual Entry?

Recommended solution: build a deterministic Git-to-Shopify sync pipeline: Markdown to normalized JSON, validation, reference resolution, dry run, then Admin GraphQL upserts by stable handle.

Why: manual creation of 30 lessons would be slow, error-prone, and hard to reproduce after editorial updates.

Shopify feature/type used: Admin GraphQL metaobject definition mutations, `metaobjectUpsert`, `metaobjectByHandle`, `fileCreate`, product/reference lookups, and API throttle handling.

Unresolved issue: API credentials, target store permissions, and exact environment setup should be created only when planning is approved.

## 11. Customer Accounts & Learning Progress (Future Phase — Documentation Only)

**Status: PLANNING ONLY. Not built. Not scheduled. No authentication, customer metafields, apps, extensions, or theme changes exist for this yet.**

Recommended solution: eventually gate the full Learning Hub behind Shopify Customer Accounts, and give logged-in learners a "My Learning" dashboard showing progress across lessons, pathways, and Knowledge Checks. This section exists so the requirement is captured before it is designed in detail, and so current lesson/schema work doesn't quietly foreclose it.

Why: the Learning Hub is intended to become an account-based learning experience. Capturing the requirement now, without building it now, keeps the door open (stable lesson IDs, stable question IDs) without slowing down current content and frontend work.

### 11.1 Account Access Model

- Sign-in uses an Oceans Optics / Shopify customer account. Required account data: email, first name, last name.
- **Account creation/access must NOT imply marketing consent.** Marketing/email subscription consent stays a separate, explicit opt-in, never bundled with account creation or Learning Hub access.
- Not yet decided: whether the Learning Hub homepage stays publicly browsable with individual lessons gated, or whether the entire hub requires an account. Do not decide this now — both are still on the table.

### 11.2 My Learning Dashboard (Future)

Logged-in learners would eventually see a customer-facing "My Learning" area with:

- Overall Learning Hub progress, pathway progress, lessons completed/started/remaining
- Last lesson viewed, "Continue Learning" / Resume
- Knowledge Checks completed, potentially Knowledge Check results
- Completion dates

Example shape:

```
Start Here — 4 of 6 complete
Gear, Masks & Vision — 5 of 7 complete
Overall Learning Hub — 12 of 31 complete
```

Progress UX (all future, not launch requirements unless explicitly promoted later): progress bars, checkmarks on completed lessons, "Continue where you left off," completion indicators on lesson/category/pathway cards, pathway completion, overall percentage. Possible later enhancement: pathway badges, completion certificates.

### 11.3 Lesson Progress Data Model (Future)

- Record: lesson started, lesson completed, completion timestamp, most recently viewed lesson.
- **Use the existing stable internal lesson IDs (R01, R02, etc.) as the storage key.** These IDs stay internal and must never need to be customer-visible. Public titles/handles may change later without breaking historical progress, because progress is keyed to the ID, not the handle or title.

### 11.4 Knowledge Check Progress Data Model (Future)

- Knowledge Check questions should eventually get stable internal identifiers, e.g. `R01-Q01`, `R01-Q02`, `R01-Q03`.
- These would support tracking: answered, selected answer, correct/incorrect, Knowledge Check complete, completion timestamp.
- **Do not add these IDs to current lesson copy yet.** See the matching note in `content-development/KNOWLEDGE-CHECK-SCHEMA-PROPOSAL.md` — stable question IDs should be incorporated when the Knowledge Check data schema (the `knowledge_check` JSON field proposed in section 5 above) is finalized, not before.

### 11.5 Technical Direction (Not Final)

- Storefront: Learning Hub lessons keep the custom storefront experience already built (no change here).
- Authentication: Shopify Customer Accounts.
- Customer account area: a possible "My Learning" dashboard/customer-account extension.
- Progress storage: customer-associated Learning Hub progress data. **Do not finalize the exact storage model yet.** Evaluate customer metafields vs. a dedicated app/database for scalability when this phase actually starts. Explicitly avoid an architecture that requires one customer metafield per individual lesson (30+ lessons would not scale as individual metafields) — prefer a single structured record (e.g. one JSON metafield or one external store) over per-lesson fields.

### 11.6 Privacy / Data Requirements (Future)

- Keep **account data required for access** (name, email) clearly distinct from **optional marketing consent** — never auto-subscribe a Learning Hub user to marketing.
- Treat progress data as customer-associated data: the eventual implementation must account for normal Shopify/customer privacy and data-deletion requirements (e.g. customer data erasure requests must also remove or anonymize associated progress data).

### 11.7 Implementation Gate — Do Not Build Until

Do not build account/progress functionality until:

- A. The launch lesson set and stable lesson IDs are finalized.
- B. The Knowledge Check structure is finalized.
- C. Stable Knowledge Check question IDs have been decided.
- D. Lesson routing/handles are sufficiently stable.
- E. The main Learning Hub frontend/visual system is established.

**Target implementation window:** after the core Learning Hub content and frontend are substantially complete, but before public Learning Hub launch. This sequencing keeps authentication/progress work from slowing down current lesson design, while still building it before launch rather than bolting it on after.

Unresolved issue: exact storage model (metafields vs. app/database), exact dashboard scope, and whether the homepage stays public-with-gated-lessons vs. fully gated all need a decision when this phase actually starts — none of that is decided here.

## Final Metaobject Set

| Metaobject | Purpose | URL handle | URL pattern |
| --- | --- | --- | --- |
| `learning_lesson` | Lesson pages | `learn` | `/pages/learn/{lesson-handle}` |
| `learning_category` | Category pages | `learn-category` | `/pages/learn-category/{category-handle}` |
| `learning_pathway` | Ordered learning routes | `learn-pathway` | `/pages/learn-pathway/{pathway-handle}` |

## BUILD NOW

- Three metaobject definitions: lesson, category, pathway
- Hybrid lesson content model
- `/pages/learn` hub page plus metaobject detail pages
- Pilot import for R01, R08, and R12 as drafts
- Duplicate-theme templates and reusable Learning Hub sections/snippets
- Dry-run import validation before any mutations

## DEFER UNTIL LATER

- Structured quiz/question metaobjects
- saved learner progress
- customer accounts / Learning Hub sign-in and the "My Learning" dashboard (see section 11 above — planning only, not scheduled)
- certificates, rewards, or discount logic
- PDF generation automation
- multilingual/metaobject translation workflow
- automatic product matching
- advanced analytics

## REQUIRES JAMES/AIRIES DECISION

- Final approval of the 26-field `learning_lesson` set
- Whether reviewer/last-reviewed should display publicly or remain admin-only
- Which first downloads are worth designing after the pilot pages work
- Whether the future prescription pathway should launch with phase one or remain parked
- Whether the Learning Hub homepage stays public-with-gated-lessons or becomes fully account-gated (section 11.1)
- Final customer-progress storage model: metafields vs. app/database (section 11.5)

