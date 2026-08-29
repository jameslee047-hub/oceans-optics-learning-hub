# Implementation Sequence

## Recommendation

Implement the Learning Hub in small, reversible phases. Prove the model with the three pilot lessons before importing the full 30-lesson architecture.

This sequence assumes no live theme changes until a duplicate or unpublished theme has been validated.

## Phase 0: Planning Sign-Off

Inputs:

- approved Stage 2 architecture
- approved Stage 3 schema and pilot lessons
- this Shopify implementation plan

Outputs:

- final field list approved
- URL plan approved
- theme implementation path approved
- import ownership rules approved

Do not connect to Shopify during this phase.

## Phase 1: Metaobject Definitions

Create definitions in Shopify only after sign-off:

- `learning_lesson`
- `learning_category`
- `learning_pathway`

Confirm:

- `publishable` enabled
- `renderable` enabled
- `onlineStore` enabled
- URL handles set correctly
- Storefront access is public read
- Admin access is merchant read/write
- field definitions match the approved docs

Stop if the target Shopify plan, permissions, or theme does not support the required capabilities.

## Phase 2: Pilot Draft Entries

Import only:

- R01 Choosing a Mask
- R08 Golden Rules for Safer Snorkeling
- R12 Currents and Rip Currents
- five category entries
- current pathway shells

Set pilot lessons to `DRAFT` first. Do not expose them publicly until template and content QA pass.

## Phase 3: Lesson Template

On a duplicate or unpublished theme:

- add `templates/metaobject/learning_lesson.json`
- add `sections/learning-lesson.liquid`
- add shared snippets
- add scoped CSS

QA the three pilot lessons across desktop and mobile.

## Phase 4: Learning Hub Homepage

Create the `/pages/learn` page and assign a custom template:

- `templates/page.learning-hub.json`
- `sections/learning-hub.liquid`

Validate category cards, pathway cards, and pilot lesson cards.

## Phase 5: Category and Pathway Templates

Add:

- `templates/metaobject/learning_category.json`
- `sections/learning-category.liquid`
- `templates/metaobject/learning_pathway.json`
- `sections/learning-pathway.liquid`

Validate:

- category filtering
- pathway lesson order
- empty optional fields
- draft lesson handling

## Phase 6: Pilot QA

Before broad import, check:

- final URLs
- SEO title and meta description
- canonical URL
- sitemap behavior
- no internal markers in HTML
- related lesson rendering
- downloads hidden when absent
- products hidden when absent
- accessibility basics
- mobile layout
- performance on image-heavy lessons

Only after this phase should any pilot lesson become `ACTIVE`.

## Phase 7: Full Lesson Import

Import the remaining approved lessons as `DRAFT`.

Then:

- validate all category references
- validate all pathway references
- validate Start Here order
- validate related lessons
- validate no internal markers
- publish in batches after editorial approval

The approved Start Here order is:

1. R07 Health, Readiness and Personal Responsibility
2. R08 Golden Rules for Safer Snorkeling
3. R01 Choosing a Mask
4. R10 Pre-Snorkel Checklist and Planning
5. R14 Buddy Communication and Awareness
6. R17 Entry and Exit Techniques

## Phase 8: Downloads

Add downloads after page rendering is stable:

- Start Here checklist
- mask selection guide
- current/rip-current safety handout if approved
- future pathway PDFs

Upload final files to Shopify Files and attach through `list.file_reference`. Keep PDF generation outside Shopify.

## Phase 9: Future Enhancements

Defer until after launch:

- structured quizzes
- saved learner progress
- certificates or rewards
- multilingual entries
- advanced product personalization
- automated redirects
- full analytics dashboard

## Rollback Plan

If something goes wrong:

- set affected metaobject entries to `DRAFT`
- remove the hub page from navigation
- keep the duplicate theme unpublished
- revert theme changes through theme version control
- do not delete metaobject definitions without a separate data-retention decision

The safest rollback is unpublishing content, not destroying definitions or entries.

