# Extraction Issues

These are the known recovery limitations and items needing manual review.

## Missing or Broken Local Resources

- `loader-default.mp4` is referenced by `genially.html` but was not found in the export folder.
- `static/js/main.947f107a.js` is referenced by `genially.html` but was not found in the export folder.

## Data Model Limitations

- The visible HTML does not contain the rendered pages; content was extracted from `window.dataBase64` instead.
- `Audios` and `Videos` arrays are empty even though one raw `playAudio` interactivity action references a local MPGA file; that action is not clearly attached to a recovered slide object.
- Text embedded directly inside raster image pixels is not recoverable from the JSON text layer and requires manual visual review.
- SVG icon/shape meaning is not always named in the data; icon intent should be checked visually.
- `zoom` and `showElements` actions identify interactive behavior, but their exact visual timing/meaning may require running the Genially viewer.
- Popup ordering is recoverable from `Slides.Order` and `slidePopup` targets, but some popup slide names are blank or generic copies.
- Some labels and words appear misspelled in the source content; they were preserved rather than corrected.

## External Resources

- Published Genially URL in metadata: https://view.genial.ly/65e9315e3c8de400147666ae/mobile-ocean-wise-ebook
- Thumbnail/render URL in metadata: https://thumbnails.genial.ly/65a798df506e8200153fc016/screenshots/0c4a5dcf-c277-4a86-bf38-65b62746fe7e.jpg
- Raw `openLink` actions in decoded action table:
  - https://www.linkedin.com/company/geniallyofficial/
  - https://twitter.com/genially_es/
  - https://www.instagram.com/genially_official/
  - https://www.youtube.com/channel/UCtq6w3zpUc5tQYEC6Q8pImg
  - https://www.facebook.com/Genially/
- These links are not clearly attached to recovered slide objects in the local data and appear to be Genially social/template links.
