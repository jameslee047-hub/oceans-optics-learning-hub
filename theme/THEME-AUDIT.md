# Stage 6 Theme Audit

Generated at: 2026-08-25T10:31:21Z

## Live Theme Snapshot

- Store: Oceans Optics
- MyShopify domain: `a44b34.myshopify.com`
- Live theme name: `V3.02`
- Live theme ID: `176147136845`
- Local read-only snapshot: `theme/base/`
- Pilot working copy: `theme/learning-hub-pilot/`

`theme/base/` was pulled from the live theme and then copied to `theme/learning-hub-pilot/`. After the copy, `theme/base/` was left unchanged.

## Existing Education Surfaces

### Learning Zone

- File: `theme/base/templates/page.learning-zone.json`
- Structure: JSON page template with an image banner, `main-page`, three video sections, and a custom quiz block.
- Supporting assets: `theme/base/assets/quizz.css`, `theme/base/assets/quizz.js`, and `theme/base/snippets/quizz.liquid`.
- Stage 6 action: left unchanged.

### OceanWise / Genially E-guide

- File: `theme/base/templates/page.ocean-wise-online.liquid`
- Structure: customer-gated Liquid template.
- Access rule: logged-in customers with the `Purchased Customer` tag see the embedded online guide.
- Embed: Genially iframe at `https://view.genially.com/6645c85640a7ff0014fc55c8`.
- Additional account embed found in `theme/base/templates/customers/account.json` using `https://view.genially.com/6760f2b608d0befa4e23601b`.
- Stage 6 action: left unchanged.

### Free Guide Marketing

- Primary page template: `theme/base/templates/page.free-guide.json`
- Regional context: `theme/base/templates/page.free-guide.context.eu.json`
- Promo sections:
  - `theme/base/sections/Snorkel-101-guide.liquid`
  - `theme/base/sections/guide-product-page.liquid`
- Product and collection templates repeatedly reference the free guide and guide promo sections.
- Header announcement links `shopify://pages/free-guide` from `theme/base/sections/header-group.json`.
- Stage 6 action: left unchanged.

## Routing Notes

- No existing `/pages/learn` page was created or modified.
- Existing product/page handles such as `learn-more-about-our-artificial-reef` are unrelated to the approved Learning Hub route.
- Approved future route model remains:
  - Lessons: `/pages/learn/{lesson-handle}`
  - Categories: `/pages/learn-category/{category-handle}`
  - Pathways: `/pages/learn-pathway/{pathway-handle}`

## Audit Conclusion

The existing Learning Zone, free guide marketing, and Genially e-guide are separate from the new Learning Hub pilot. Stage 6 added local pilot templates only and did not retire, edit, redirect, or replace any existing education implementation.
