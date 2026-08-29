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

Use structured placeholders while tools, products, downloads, or CTAs are not yet live.

- `[TOOL: mask-sizing-tool]`
- `[TOOL: underwater-lens-calculator]`
- `[PRODUCT: prescription-mask-collection]`
- `[DOWNLOAD: pre-snorkel-checklist]`
- `[CTA: find-your-mask]`

Do not invent URLs.

## Knowledge Check Rules

Keep knowledge checks inside Markdown lesson files for now. Use a structured format that can later convert into quiz data. Not every lesson needs a quiz; include one only when it improves learning or retention.

