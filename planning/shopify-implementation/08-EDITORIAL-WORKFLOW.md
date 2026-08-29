# Editorial Workflow

## Recommendation

Keep Git as the editorial source of truth. Shopify should contain only fields needed for public rendering, search, navigation, merchandising, and operational publication checks.

The repository remains the place for provenance, extraction history, content gaps, reviewer notes, and draft lesson development.

## Source Systems

| System | Role |
| --- | --- |
| `planning/learning-hub-architecture-v2/` | Approved information architecture and lesson map |
| `content-development/` | Lesson schema, editorial standards, pilots, and future lesson drafts |
| Shopify metaobjects | Publication-ready structured content for the storefront |
| Shopify theme | Presentation layer only |

## Source-of-Truth Decision

Recommendation: choose Option B, repository as source of truth, with Shopify as the publication target.

Option A, Shopify as primary source after import, would make storefront editing easy but would weaken review history, reproducible imports, and source provenance.

Option B, Git as primary source, fits this project best because the team is developing 30+ lessons from extracted material, reviewing safety-sensitive content, and needs auditable changes.

Option C, a hybrid workflow, is useful only for emergency live edits or media confirmation. If a Shopify Admin edit changes Git-managed content, it should be copied back into the repository before the next sync.

## Status Flow

Recommended repository states:

1. `Draft`
2. `Editorial review`
3. `Safety/current review`
4. `Approved`
5. `Shopify ready`
6. `Imported as draft`
7. `Published`

Shopify publication states:

- `DRAFT`: imported but not public
- `ACTIVE`: approved for public rendering

The import process should create or update entries as `DRAFT` unless the repository record explicitly permits publication.

## Ready-to-Publish Gate

A lesson can become `ACTIVE` only when:

- required public fields are present
- no internal review markers remain in public fields
- all required safety/current/product review tags are resolved
- `reviewer` is populated when the lesson is safety, health, conditions, product-current, or marine-conservation sensitive
- `last_reviewed` is populated for reviewed lessons
- linked products, downloads, related tools, and related lessons resolve cleanly
- SEO fields have either explicit values or approved fallbacks

## Fields Allowed in Shopify

Shopify should receive:

- title
- lesson ID
- short description
- lesson type
- category reference
- pathway references
- estimated reading time
- hero media reference
- public lesson body
- public instructor tips
- public common mistakes
- public safety notes
- key takeaways
- related lessons
- related tools
- related products
- downloadable resources
- primary CTA
- author
- reviewer
- last reviewed
- review tags
- editorial status
- publication readiness
- SEO title
- meta description

## Repository-Only Fields

Keep these out of Shopify:

- original Genially source IDs
- source page paths
- extraction notes
- content gaps
- instructor-input opportunities
- raw safety-review notes
- raw fact-check notes
- raw current-guidance notes
- information omitted
- duplicate consolidation notes
- visual briefs
- visual status
- unresolved content placeholders
- private editorial comments
- reviewer discussion threads

## Internal Marker Policy

Internal markers such as `[NEEDS REVIEW]`, `[FACT CHECK]`, `[SAFETY REVIEW]`, and unresolved placeholders may exist in Git during drafting. They must not be imported into public Shopify fields.

Validation should fail if a public field contains obvious internal markers.

## Manual Shopify Edits

Avoid editing lesson content directly in Shopify once import automation exists.

Recommended rule:

- Git owns lesson text, relationships, SEO text, and workflow status.
- Shopify Admin may be used for emergency unpublishing, previewing, and media confirmation.
- Any emergency copy fix made in Shopify should be copied back into Git before the next sync.

This prevents silent drift between the storefront and the repository.

## Review Responsibilities

Safety and current-guidance lessons need a named reviewer before publication. This includes, at minimum:

- health/readiness
- safer snorkeling rules
- currents and rip currents
- beach flags and local warnings
- buddy communication
- entry and exit techniques
- breath, equalization, and ear comfort
- marine-life safety and conservation guidance

The reviewer name and review date can be stored in Shopify as admin fields, but deeper notes should remain in Git.

## Publication Checklist

Before an entry is marked `ACTIVE`, confirm:

- title and summary are clear
- lesson body has no internal comments
- links resolve
- product references are current
- file references are ready
- related lessons exist and are active or intentionally draft-hidden
- SEO title and meta description are acceptable
- safety/current review requirements are met
- page preview has no empty blocks
