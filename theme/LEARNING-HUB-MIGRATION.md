# Learning Hub Theme Migration Notes

Generated at: 2026-08-25T10:31:21Z

## Stage 6 Scope

Stage 6 prepares a local Shopify theme pilot for the approved Learning Hub architecture. It does not publish anything, create `/pages/learn`, activate DRAFT metaobjects, create pathway entries, or change live navigation.

## Local Theme Strategy

1. Pull live `V3.02` into `theme/base/`.
2. Treat `theme/base/` as read-only.
3. Copy `theme/base/` to `theme/learning-hub-pilot/`.
4. Add Learning Hub code only inside `theme/learning-hub-pilot/`.
5. Use Shopify Theme Check.
6. Use Shopify development theme preview only.

## New Pilot Rendering Files

- `theme/learning-hub-pilot/assets/learning-hub.css`
- `theme/learning-hub-pilot/sections/learning-hub-homepage.liquid`
- `theme/learning-hub-pilot/sections/learning-lesson.liquid`
- `theme/learning-hub-pilot/sections/learning-category.liquid`
- `theme/learning-hub-pilot/sections/learning-pathway.liquid`
- `theme/learning-hub-pilot/templates/page.learning-hub.json`
- `theme/learning-hub-pilot/templates/metaobject/learning_lesson.json`
- `theme/learning-hub-pilot/templates/metaobject/learning_category.json`
- `theme/learning-hub-pilot/templates/metaobject/learning_pathway.json`

## Rendering Model

- The homepage template is a local visual pilot with static blocks for the approved Start Here sequence, five categories, and three pilot lessons.
- Lesson pages render from the current `learning_lesson` metaobject.
- Category pages render from the current `learning_category` metaobject and derive lesson cards from active `learning_lesson` entries with a matching `category` reference.
- Pathway pages render `learning_pathway.ordered_lessons` in stored order.
- Empty optional fields are not rendered.
- Administrative/editorial-only fields are not rendered.

## Draft Preview Gate

The Stage 5C entries are intentionally DRAFT. In the development theme preview, Shopify recognized the `/pages/learn/{handle}` routes as metaobject routes while the preview theme query was present, then redirected to the canonical route and returned 404 without exposing DRAFT content.

Stage 6 therefore stops at this gate. Do not activate pilot entries automatically. A future approval is required before activating any Learning Hub metaobject entries for full visual QA.

## Existing Systems

Do not alter during this pilot:

- old Learning Zone page/template
- Genially iframe e-guide
- free guide marketing page
- account/customer guide access
- live navigation

The Learning Hub can later replace the structured education and Genially e-guide experience, but that is outside Stage 6.

## Next Approval Gate

Before full visual QA, choose one safe preview path:

- explicitly approve activating the three pilot lesson entries and necessary category entries, or
- use a Shopify-supported draft-preview mechanism if available for publishable metaobjects without changing status.

No broader theme, content, navigation, or Shopify resource changes should be made as part of that decision.
