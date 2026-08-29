# Google Drive Sync Guide

Google Docs are external editor working copies.

Repository `public-copy.md` files are the approved source of truth.

Shopify is the publication destination only.

## A. Export To Google Drive

`public-copy.md` -> matching Google Doc

Rules:

- export public copy only
- do not export `internal-notes.md`
- preserve headings and list structure
- preserve Knowledge Check answer keys
- preserve SEO title/meta description
- do not rewrite copy during export

## B. Import Back From Google Drive

approved Google Doc -> matching `public-copy.md`

Rules:

- never overwrite `internal-notes.md`
- never import Drive comments or suggestion metadata
- only use the accepted/final document text
- preserve Markdown hierarchy
- preserve Knowledge Check answer keys
- show the text diff before finalizing
- do not commit automatically unless explicitly approved
- do not sync Shopify automatically

## Content Backlog

Keep `content-development/CONTENT-DEVELOPMENT-BACKLOG.md` separate from public copy and Google editor docs.

Do not export internal content gaps into editor-facing lesson documents.

If a content gap later becomes approved customer-facing content:

1. resolve the backlog item
2. add approved wording into the appropriate `public-copy.md`
3. mark the backlog item resolved

If an editor suggests new factual content, do not silently treat it as approved. Mark it as:

`[EDITOR SUGGESTION — VERIFY: ...]`

and review it before entering the canonical copy.
