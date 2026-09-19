# Standard Lesson Schema

This schema is for content drafting and editorial planning. It is not a Shopify metaobject design.

The lesson format is modular. A short safety briefing, an equipment guide, and a longer science or conditions explainer can share the same core structure, but optional public components should only appear when they improve the lesson.

Use this schema together with [EDITORIAL-STANDARDS.md](EDITORIAL-STANDARDS.md).

## Core

| Field | Purpose | Public or internal | Required | Repeatable/list |
| --- | --- | --- | --- | --- |
| Lesson ID | Stable architecture ID, such as `R01` | Internal, may appear in editorial/admin views | Required | No |
| Title | Public lesson title | Public | Required | No |
| Slug | URL handle | Internal setup field; visible indirectly in URL | Required before publication | No |
| Primary category | Main Learning Hub category | Public and internal | Required | No |
| Lesson type | Content format, such as equipment guide, safety briefing, conditions explainer, skill lesson, science lesson, or conservation lesson | Internal, optionally public for filtering later | Required | No |
| Pathways | Guided routes that include the lesson | Public and internal | Optional | Yes |
| Short description | One- or two-sentence lesson summary | Public | Optional but recommended | No |
| Estimated reading time | Reader expectation and editorial planning | Public and internal | Optional | No |

## Public Content

| Field | Purpose | Public or internal | Required | Repeatable/list |
| --- | --- | --- | --- | --- |
| Hero media | Published image, diagram, video, or other main media asset | Public | Optional | Usually no |
| Introduction | Opens the lesson and orients the reader | Public | Recommended | No |
| Main content | Flexible body sections, steps, comparisons, or explanations | Public | Required | Yes, as modular content blocks |
| Key takeaways | Short summary points | Public | Optional but recommended | Yes |

Key takeaways should be quick memory prompts, not a second summary paragraph. In most lessons, use 3-5 concise bullet-style statements, generally 8-18 words each. Keep one clear idea per takeaway, avoid repeating full explanations, do not introduce new information, and preserve important safety qualifiers where removing them would change the meaning.

## Optional Public Components

| Field | Purpose | Public or internal | Required | Repeatable/list |
| --- | --- | --- | --- | --- |
| Why this matters | Explains practical value when the introduction does not already do it | Public | Optional | No |
| Instructor tips | Practical advice supported by source content or real instructor input | Public | Optional | Yes |
| Common mistakes | Beginner mistakes supported by source content or instructor input | Public | Optional | Yes |
| Safety notes | Public safety cautions after review | Public | Optional | Yes |
| Knowledge check | Lightweight retention quiz | Public | Optional | Yes |
| Related lessons | Cross-links to other Learning Hub lessons | Public and internal | Optional | Yes |
| Related tools | Oceans Optics tool links or structured placeholders | Public when live; internal while planned | Optional | Yes |
| Related products | Product links or structured placeholders | Public when approved; internal while planned | Optional | Yes |
| Downloadable resource | Checklist, quick reference, PDF, diagram, or printable | Public when created; internal while planned | Optional | Yes |
| Primary CTA | One main action when it naturally fits the lesson | Public when approved; internal while planned | Optional | No |

## Editorial / Internal

| Field | Purpose | Public or internal | Required | Repeatable/list |
| --- | --- | --- | --- | --- |
| Source IDs | Exact recovered source IDs used | Internal only | Required for source-based lessons | Yes |
| Source files | Local extracted Markdown files used | Internal only | Required for source-based lessons | Yes |
| Source confidence | Editorial confidence in how strongly sources support the draft | Internal only | Required | No |
| Content gaps | Missing content needed to make the lesson stronger | Internal only | Optional | Yes |
| Instructor input opportunities | Places where Oceans Optics expertise should be added | Internal only | Optional | Yes |
| Fact-check requirements | Claims needing verification before publication | Internal only | Optional | Yes |
| Safety-review requirements | Safety-sensitive claims or procedures needing expert review | Internal only | Required for safety-tagged lessons | Yes |
| Current-guidance requirements | Time-sensitive or geographically variable guidance needing review | Internal only | Required for current-guidance-tagged lessons | Yes |
| Information omitted | Relevant source content intentionally left out | Internal only | Optional | Yes |
| Consolidated duplicate material | Notes on repeated source ideas merged into one lesson point | Internal only | Optional | Yes |
| Visual brief | Internal direction for image, diagram, or media creation | Internal only | Optional | Yes |
| Visual status | Current visual state | Internal only | Required | No |
| Review tags | Review categories such as safety, current guidance, product accuracy, prescription vision, instructor input, medical, first aid, breath-hold, shallow-water blackout, or equalizing | Internal only | Required | Yes |
| Editorial status | Draft, in review, approved, published, or archived | Internal only | Required | No |
| Publication readiness | Ready, blocked by review, blocked by missing content, or ready for copy edit | Internal only | Required | No |
| Author | Person or system that drafted the lesson | Internal only | Required | No |
| Reviewer | Named reviewer who completed factual/editorial/safety review | Internal only | Required before publication readiness can be `Ready` for tagged lessons | No |
| Last reviewed | Date factual/editorial review was actually completed | Internal only | Required before publication readiness can be `Ready` | No |

Suggested `visual_status` values:

- none needed
- recommended
- required
- asset available
- needs design

## SEO

| Field | Purpose | Public or internal | Required | Repeatable/list |
| --- | --- | --- | --- | --- |
| SEO title | Search title candidate | Internal setup field | Optional until publication prep | No |
| Meta description | Search result description candidate | Internal setup field | Optional until publication prep | No |

## Recommended Markdown Draft Template

Omit optional public components when they do not add value.

```markdown
# Internal Metadata

## Core

- Lesson ID:
- Title:
- Slug:
- Primary category:
- Lesson type:
- Pathways:
- Short description:
- Estimated reading time:

## Editorial / Internal

- Source IDs:
- Source files:
- Source confidence:
- Review tags:
- Editorial status:
- Publication readiness:
- Author:
- Reviewer:
- Last reviewed:
- Fact-check requirements:
- Safety-review requirements:
- Current-guidance requirements:
- Content gaps:
- Instructor input opportunities:
- Information omitted:
- Consolidated duplicate material:
- Visual brief:
- Visual status:

## SEO

- SEO title:
- Meta description:

# Public Lesson Draft

## Introduction

## Main Content

## Key Takeaways

# Optional Components

## Why This Matters

## Instructor Tips

## Common Mistakes

## Safety Notes

## Knowledge Check

**Q1. Question text**

- A. Answer
- B. Answer
- C. Answer

**Correct:** B

**Explanation:** Short explanation.

## Related Lessons

## Related Tools

## Related Products

## Downloadable Resource

## Primary CTA

# Editorial Notes
```

## Public Display Rules

Public content must read like original Oceans Optics educational content. Do not display internal review markers, extraction history, source file paths, unresolved content gaps, unresolved safety requirements, author/reviewer workflow notes, or publication-readiness status in the public lesson.

If a claim is too uncertain to publish, remove it from the public draft and capture the requirement in the internal fields or editorial notes.

## Placeholder Rules

Use structured placeholders while tools, products, downloads, media, or CTAs are not yet live.

- `[TOOL: mask-sizing-tool]`
- `[TOOL: underwater-lens-calculator]`
- `[PRODUCT: prescription-mask-collection]`
- `[DOWNLOAD: pre-snorkel-checklist]`
- `[CTA: find-your-mask]`
- `[MEDIA: stable-media-key]`

Do not invent URLs.

Place tool, product, CTA, and media placeholders on their own line at the exact point where the rendered button or media should appear. The generator preserves that source position. Related lessons are the exception: they are extracted into end-of-lesson navigation.

`[MEDIA: key]` is the single canonical directive for any inline visual -- a static image, a two-image comparison, a diagram, an animated GIF, a looping video, or a gallery. The copy never names the file type, only a stable key and its position. See `content-development/media/README.md` for the full schema (local dev fixture shape, the production `learning_media`/`learning_media_item` Shopify metaobjects, and the editor workflow). Each item behind a key needs real image data before the placeholder is used in approved copy: an image URL or Shopify file reference, required alt text, and width/height or aspect-ratio data.

## Knowledge Check Rules

Keep knowledge checks inside Markdown lesson files for now. Use a structured format that can later convert into quiz data. Not every lesson needs a quiz; include one only when it improves learning or retention.

## Drive → Repo Reconciliation Rules

Google Drive is the editorial source of truth for lesson wording. When pulling a Drive doc's current content into a lesson's `public-copy.md`, structure must be reconstructed deliberately -- it does not survive a plain-text copy/paste.

**What went wrong once (2026-09-01, R08/R12):** two lessons' `public-copy.md` files were written as flattened plain text -- no `##`/`###` heading markers beyond the title, no blank lines between paragraphs, no `- `/`1. ` list markers. The wording was correct, but `markdownToShopifyRichText()` (in `shopify/scripts/lib/learning-data.js`) joins any run of non-blank lines into a single paragraph, and `parseBulletList()` requires literal `- ` prefixes to populate list-shaped fields (`key_takeaways`, etc.). The result: entire lessons rendered as one wall of text, and `key_takeaways` silently came back as an empty array despite Drive having 6-11 items. `validate-learning-data.js` had no check that would have caught this.

**The rule going forward:**

- Every Drive paragraph becomes its own markdown paragraph block, separated by a blank line. Never join two Drive paragraphs onto adjacent lines.
- Every section Drive treats as a heading -- whether or not the Drive export actually marks it with `#`/`##` -- becomes a real `##`/`###` line in `public-copy.md`, with a blank line before and after. This includes the fixed schema sections (`Instructor Tips`, `Common Mistakes`, `Safety Note(s)`, `Key Takeaways`, `Knowledge Check`, `Related Lessons / Next Step`) and any lesson-specific section that functions as one, even if the Drive author applied bold/font styling instead of a real "Heading" paragraph style rather than no styling at all.
- Do not invent a heading for content Drive does not structurally separate into its own section -- only promote paragraphs that are already Drive's own distinct blocks.
- List-shaped content (`Key Takeaways`, `Instructor Tips`, `Common Mistakes`, or any lesson-specific bulleted/numbered content) gets real `- ` or `1. ` markers, even if the Drive export shows the items as plain blank-line-separated phrases with no visible marker. `key_takeaways` in particular is a parsed array (`parseBulletList`, matching only `^- `) -- without the marker, the field silently ends up empty.
- For a numbered "lead sentence + explanation paragraph" pattern (e.g. Golden Rules' 13 rules), keep it as one continuous ordered list: put the explanation as a 2+-space-indented continuation line directly under the lead line (no blank line between them), which `markdownToShopifyRichText()` merges into that same list item. Splitting each into `1. Lead` + a separate paragraph resets the visible number back to "1." for every item, since each becomes its own single-item `<ol>`.
- Keep `[MEDIA:]`/`[TOOL:]`/`[PRODUCT:]`/`[CTA:]` directives on their own line, exactly where they were already approved -- reconciliation must never move, duplicate, or drop them.
- Prefer writing real `##`/`###` markdown directly (matching R02-R06/R31's convention) over relying on `normalizePublicCopyMarkdown`'s flattened-text-plus-allowlist path (`PUBLIC_H2_HEADINGS`/`PUBLIC_H3_HEADINGS` in `generate-pilot-data.js`). That allowlist exists only as a legacy compatibility path for R01's already-flattened source; extending it for new lessons repeats the exact fragility that caused this incident (a lesson-specific heading silently missing from a shared, easy-to-forget list). New or reconciled content should not depend on it.
- After reconciling, run `learning:validate` and confirm `STRUCTURE_COLLAPSE` does not fire (see below) before syncing to Shopify.

## Structural Validation Guard

`validate-learning-data.js` runs `checkStructureCollapse()` (code `STRUCTURE_COLLAPSE`, blocking `ERROR`) as a deterministic check against the exact failure mode above:

1. Two or more `Qn.` Knowledge Check questions found inside the same blank-line-delimited paragraph block (proves questions lost their separation).
2. Two or more of the fixed schema section labels (`Instructor Tips`, `Common Mistakes`, `Safety Note(s)`, `Key Takeaways`, `Knowledge Check`, `Related Lessons / Next Step`) found as inline substrings of the same block rather than each on its own heading line (proves section boundaries were lost).
3. `key_takeaways` came back as an empty array despite `instructor_tips` or `common_mistakes` being substantially populated (proves the list markers were dropped rather than the section genuinely being blank).

These are intentionally narrow, near-zero-false-positive signals rather than a length-based heuristic, so a single legitimately long paragraph will not trip it.
