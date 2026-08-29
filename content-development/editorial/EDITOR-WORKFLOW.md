# Learning Hub Editor Workflow

Google Docs = external editor working copy

Repository `public-copy.md` = approved canonical source of truth

Shopify = publication destination

Do not create two competing canonical sources.

## Workflow

1. Approved public-copy.md is exported into the corresponding Google Doc.
2. External editor works in Google Docs using Suggesting mode.
3. James reviews and accepts/rejects suggestions.
4. Once the Google Doc is approved, Codex reads the approved Google Doc.
5. Codex updates ONLY the matching public-copy.md file.
6. Codex shows a diff before finalizing/committing.
7. Markdown formatting is checked.
8. Run validation.
9. Commit approved changes.
10. Shopify sync happens only after explicit approval.

## Source Of Truth

Google Docs are working/editorial copies only.

The repository `public-copy.md` files are the approved source of truth for customer-facing lesson copy.

`internal-notes.md` files are the approved source of truth for internal editorial and project information.

Shopify is the publication destination only.

Saving a Google Doc must NOT automatically update Shopify.

Saving `public-copy.md` must NOT automatically update Shopify.
