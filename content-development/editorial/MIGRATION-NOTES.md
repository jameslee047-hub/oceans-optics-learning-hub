# Learning Hub Editorial Migration Notes

## Old Canonical Pilot Paths

These combined public/internal pilot files are archived and are no longer canonical editable sources:

- `content-development/pilots/R01-choosing-a-mask.md`
- `content-development/pilots/R08-golden-rules-for-safer-snorkeling.md`
- `content-development/pilots/R12-currents-and-rip-currents.md`

## New Canonical Public-Copy Paths

- `content-development/lessons/R01-choosing-a-mask/public-copy.md`
- `content-development/lessons/R08-golden-rules-for-safer-snorkeling/public-copy.md`
- `content-development/lessons/R12-currents-and-rip-currents/public-copy.md`

## New Internal-Notes Paths

- `content-development/lessons/R01-choosing-a-mask/internal-notes.md`
- `content-development/lessons/R08-golden-rules-for-safer-snorkeling/internal-notes.md`
- `content-development/lessons/R12-currents-and-rip-currents/internal-notes.md`

## Archived Paths

- `content-development/archive/pre-public-copy-split/R01-choosing-a-mask.md`
- `content-development/archive/pre-public-copy-split/R08-golden-rules-for-safer-snorkeling.md`
- `content-development/archive/pre-public-copy-split/R12-currents-and-rip-currents.md`
- `content-development/archive/pre-public-copy-split/README.md`

## Scripts Affected

- `shopify/scripts/generate-pilot-data.js` previously read the old combined pilot files.
- It now reads customer-facing copy from each `public-copy.md` file and implementation/internal references from each matching `internal-notes.md` file.
- No Shopify sync was run as part of this migration.

## Content Backlog Affected

- `content-development/CONTENT-DEVELOPMENT-BACKLOG.md` remains separate from public copy and editor-facing Google Docs.
- Existing backlog references to the old pilot files were updated to the matching `internal-notes.md` files because those items track internal gaps, review needs, and implementation follow-up.

## Generated Review Files Affected

- `content-development/COPY-REVIEW.md` was regenerated as a convenience view from the site-copy files and the new `public-copy.md` lesson files.
- `ALL-PILOT-LESSONS.md` was not present in the repository at the time of migration.
- Generated review files are not canonical sources of truth.

## Follow-Up Before Shopify Sync

- Run the local pilot-data generation and validation before any future Shopify sync.
- Review generated Shopify lesson JSON diffs before approving publication or sync work.
- Keep Google Docs as editor working copies only; approved edits must return to `public-copy.md` before Shopify is updated.
