# Pilot Review

This review compares the revised Stage 3 pilot lessons after locking the editorial standards:

- `R01 Choosing a Mask`
- `R08 Golden Rules for Safer Snorkeling`
- `R12 Currents & Rip Currents`

The goal is to confirm whether one standard lesson schema can support an equipment guide, a short safety briefing, and a more substantial conditions explainer.

## What Changed After Review

- US English is now the content standard.
- `rip current` is the standard term.
- Internal review markers have been removed from public lesson copy.
- Unverified or incomplete guidance now lives in internal metadata and editorial notes.
- Structured placeholders are used for tools, products, downloads, and CTAs.
- Knowledge checks now use a consistent Markdown structure.
- `hero_media` is public; `visual_brief` and `visual_status` are internal.
- Safety-tagged and current-guidance-tagged lessons are blocked until they have a named reviewer.

## Fields Used in All Three

- Lesson ID
- Title
- Slug
- Primary category
- Lesson type
- Pathways
- Short description
- Estimated reading time
- Source IDs
- Source files
- Source confidence
- Review tags
- Editorial status
- Publication readiness
- Author
- Reviewer
- Last reviewed
- Fact-check requirements
- Content gaps
- Instructor input opportunities
- Information omitted
- Consolidated duplicate material
- Visual brief
- Visual status
- SEO title
- Meta description
- Public lesson draft
- Key takeaways
- Knowledge check
- Related lessons

These fields were useful across all pilots. Even the shortest safety briefing benefits from a clear source trail, review state, and publication-readiness status.

## Fields Used Only Occasionally

- Hero media: none of the pilots has a finished public asset yet.
- Why this matters: useful for `R01` and `R12`; not needed as a separate section in the short `R08` briefing.
- Instructor tips: useful in all three pilots, but should remain optional.
- Common mistakes: useful in all three pilots, but not every future lesson will have a supported mistake.
- Safety notes: useful for `R08` and `R12`; unnecessary for the current `R01` draft.
- Related tools: useful for `R01` and possibly `R12`; not needed for every safety lesson.
- Related products: useful for `R01`; not useful for `R08` or `R12`.
- Downloadable resource: useful as a placeholder for all three pilots, but should only be public once the asset exists.
- Primary CTA: useful for `R01`; unnecessary for `R08` and `R12`.

## Fields That Felt Forced or Unnecessary

- A separate `Why this matters` block can add padding to very short lessons.
- Product fields feel forced in safety, science, and conservation lessons unless there is a direct fit.
- Public hero media should not be forced. Some lessons may work better with a checklist, diagram, icon row, or no hero at all.
- SEO fields are useful for future publishing, but they are secondary during early drafting.

## Additional Fields That Proved Useful

These fields from the revised schema should stay:

- `lesson_type`
- `source_confidence`
- `review_tags`
- `publication_readiness`
- `visual_brief`
- `visual_status`
- `primary_cta`
- separate `Author`, `Reviewer`, and `Last reviewed`
- separate `Safety-review requirements` and `Current-guidance requirements`

The reviewer separation matters because `Last reviewed` should mean completed factual/editorial review, not file edit date.

## Mobile Readability

The revised schema still works well for mobile as long as public lessons use short paragraphs, compact lists, and optional components sparingly.

`R08` is strongest as a numbered briefing. It should stay short.

`R12` is longer, but headings, short sections, and diagrams will keep it scannable.

`R01` works as a comparison guide, but it will become more useful once Oceans Optics adds fit, prescription, and lens-selection expertise.

## Can One Schema Support All Three?

Yes. One schema can support all three lesson types if the public body stays modular.

The shared schema should create consistency through identity, source tracking, review workflow, related-content structure, and optional components. It should not force every lesson into the same article shape.

## Likely Shopify Field Types Later

This is not a Shopify schema, but the revised content model suggests likely future field types:

- Lesson ID: single-line text
- Title: single-line text
- Slug: URL handle
- Primary category: controlled reference or single-select
- Lesson type: controlled single-select
- Pathways: list of references or controlled tags
- Short description: multi-line text
- Estimated reading time: number or single-line text
- Hero media: file/image reference
- Public lesson body: rich text or modular content blocks
- Instructor tips: list of rich-text blocks
- Common mistakes: list of rich-text blocks
- Safety notes: list of rich-text blocks
- Key takeaways: list of text items
- Knowledge check: structured quiz data later; Markdown for now
- Related lessons: list of lesson references
- Related tools: list of tool/link references
- Related products: list of product references
- Downloadable resource: file or link reference
- Primary CTA: link/reference field
- Source IDs: list of single-line text
- Source files: internal list of text values
- Source confidence: controlled single-select
- Content gaps: internal list of notes
- Instructor input opportunities: internal list of notes
- Fact-check requirements: internal list of notes
- Safety-review requirements: internal list of notes
- Current-guidance requirements: internal list of notes
- Information omitted: internal rich text
- Consolidated duplicate material: internal rich text
- Visual brief: internal rich text
- Visual status: controlled single-select
- Review tags: controlled list
- Editorial status: controlled status field
- Publication readiness: controlled status field
- Author: text or user reference
- Reviewer: text or user reference
- Last reviewed: date
- SEO title: single-line text
- Meta description: multi-line text

## Decisions Locked Before Drafting Remaining Lessons

- Use US English.
- Use `rip current`, not `riptide`, except when explaining that `riptide` is common but inaccurate.
- Use standardized compound terms such as `dual-lens mask`, `single-lens mask`, `shallow-water blackout`, `breath-hold`, and `pre-snorkel`.
- Keep review markers out of public lesson copy.
- Keep unresolved review needs in internal metadata and editorial notes.
- Require a named reviewer before safety, medical, first aid, breath-hold, shallow-water blackout, equalizing, or current-guidance lessons can become `Ready`.
- Keep `Author`, `Reviewer`, and `Last reviewed` separate.
- Use structured placeholders such as `[TOOL: mask-sizing-tool]`, `[PRODUCT: prescription-mask-collection]`, `[DOWNLOAD: pre-snorkel-checklist]`, and `[CTA: find-your-mask]`.
- Keep knowledge checks in Markdown for now using the structured Q/A format.
- Use `hero_media` for public media and `visual_brief` / `visual_status` for internal planning.

## Open Decisions Before Drafting Remaining Lessons

- Decide who the named reviewers will be for safety/current-guidance lessons.
- Decide the final source-confidence scale values and whether `Medium` is acceptable for launch candidates.
- Decide whether product and tool placeholders should remain in draft files once real links exist elsewhere.
- Decide whether public safety notes should stay in short lessons like `R08` or move into the main body.
- Decide the visual production workflow for diagrams, checklists, and downloadable resources.

## Recommended Working Schema

Use the revised schema in [LESSON-SCHEMA.md](LESSON-SCHEMA.md) as the working standard.

Required core:

- Lesson ID
- Title
- Slug
- Primary category
- Lesson type
- Pathways
- Short description
- Estimated reading time

Public content:

- Hero media
- Introduction
- Main content
- Key takeaways

Optional public components:

- Why this matters
- Instructor tips
- Common mistakes
- Safety notes
- Knowledge check
- Related lessons
- Related tools
- Related products
- Downloadable resource
- Primary CTA

Editorial/internal:

- Source IDs
- Source files
- Source confidence
- Content gaps
- Instructor input opportunities
- Fact-check requirements
- Safety-review requirements
- Current-guidance requirements
- Information omitted
- Consolidated duplicate material
- Visual brief
- Visual status
- Review tags
- Editorial status
- Publication readiness
- Author
- Reviewer
- Last reviewed

SEO:

- SEO title
- Meta description

## Recommendation

Proceed with this schema for future lesson drafting, but do not draft additional lessons until reviewers and visual workflow expectations are decided. The schema is now strong enough to support the remaining lessons without forcing every page into the same shape.

