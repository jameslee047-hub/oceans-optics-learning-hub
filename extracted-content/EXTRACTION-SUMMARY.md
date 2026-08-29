# Extraction Summary

This summary was generated after the initial extraction pass from the existing files in `extracted-content`. It does not change the original Genially export or the already extracted page/content files.

## Source

- Source export: `/Users/jameslee/Downloads/Ocean Wise Ebook`
- Primary source file: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html`
- Main data source: `window.dataBase64` embedded in `genially.html`, decoded as JSON.
- Supporting local folders reviewed: `images`, `audios`, `static`, `css`, `fonts`.

## Recovered Structure

- Total Genially slide records recovered: 129.
- Main/menu/content screens: 32.
- Popup/modal-style screens: 97.
- Cover screen: 1.
- Main menu screen: 1.
- Section menu screens: 5.
- Main educational content pages: 25.

## Recovered Data Objects

- Text objects: 395.
- Image objects: 113.
- SVG objects: 403.
- Interactivity actions: 375.
- Audio objects in `Audios` array: 0.
- Video objects in `Videos` array: 0.
- Raw audio actions detected: 3, all referencing `audios/a05cfc99-704a-43d8-9d59-24422ba3f616.mpga`.

## Files Created By Extraction

- `CONTENT-INVENTORY.md`: full recovered content inventory in original slide order.
- `STRUCTURE.md`: reconstructed guide hierarchy and navigation.
- `ASSET-INVENTORY.md`: local asset catalogue and detected usage.
- `EXTRACTION-ISSUES.md`: known extraction limitations and missing resources.
- `pages/`: one Markdown file for each recovered screen/popup.
- `REVIEW-FLAGS.md`: human review items generated from the recovered extraction.
- `EXTRACTION-SUMMARY.md`: this summary.

## Page Files

- Individual Markdown page files created: 129.
- Page files are numbered in original slide order from `001` to `129`.
- Main pages and popup/modal slides were kept separate so the original Genially structure remains traceable.

## Asset Summary

- Files catalogued: 195.
- Image files: 96.
- Audio files: 1.
- Static JS files: 30.
- CSS files: 7.
- Assets were not copied or renamed.

## Navigation and Interactivity

- Page order is recoverable from `Slides[*].Order`.
- Main menu and section navigation are recoverable from `goToSlide` actions.
- Popup/modal relationships are recoverable from `slidePopup` and `closeSlidePopup` actions.
- One mapped `zoom` interaction was detected on source `036 Snorkel Placement`.
- Raw `openLink` actions were detected in the decoded action table, but they appear to be Genially/template social links and are not clearly attached to recovered slide objects.

## Known Missing Local Resources

- `loader-default.mp4`
- `static/js/main.947f107a.js`

These files are referenced by `genially.html` but were not found in the local export folder.

## Recovery Confidence

- Text recovery: high for text stored in Genially `Texts[*].TextMessage`.
- Page ordering: high, based on `Slides[*].Order`.
- Popup mapping: high where `slidePopup` targets were present.
- Image-to-page mapping: high for `Slides[*].Background` and `Images[*].Source`.
- Audio mapping: medium-low, because the local MPGA file is referenced by raw actions and hidden preload markup but not clearly mapped to a specific slide.
- Visual/animation meaning: medium-low, because some meaning may exist only in images, SVGs, animations, or runtime behavior.

## Not Performed

- No copy was rewritten.
- No spelling or factual corrections were made.
- No redesign or new website work was performed.
- No assets were copied, renamed, compressed, or modified.
- No files inside `/Users/jameslee/Downloads/Ocean Wise Ebook` were modified.
