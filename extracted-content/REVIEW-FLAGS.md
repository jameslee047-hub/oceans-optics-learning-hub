# Review Flags

These flags identify items that need human review before the recovered content is rewritten, redesigned, published, or used as the basis for the new Learning Hub.

## High Priority

### Missing local runtime files

Source: `genially.html`

Flag:

- `loader-default.mp4` is referenced but missing.
- `static/js/main.947f107a.js` is referenced but missing.

Why it matters: the recovered text/content archive is usable, but the original offline Genially export may not run correctly as-is.

Recommended review: confirm whether these files exist in another export, whether they are needed for archival completeness, or whether the current text extraction is sufficient.

### Safety-sensitive educational content

Sources:

- `018 Physiology`
- `032 First Aid Essentials for Snorkeling`
- `079 Treat minor cuts and bruises with antiseptic wipes and adhesive bandages.`
- `084 Rescue Breaths:`
- `085 Shallow Water Blackouts`
- `088 Chest Compressions:`
- `093 Hypocapnia`
- `095 Drowning:`
- `109 Jellyfish Stings:`
- `110 Cardiopulmonary Resuscitation (CPR):`
- `114 Hypercapnia`
- `115 CO2 Effects and First Aid`

Why it matters: these topics involve medical, rescue, and emergency-response guidance. The extraction preserved the source content, but publication should require instructor, medical, and legal review.

Recommended review: verify accuracy, scope, disclaimers, jurisdictional emergency guidance, and whether any content should be replaced by references to certified training providers.

### Text possibly embedded only in images

Sources: all pages with image-heavy content, especially equipment diagrams, flag references, marine life visuals, and technique illustrations.

Why it matters: extraction recovered Genially text-layer content. Text rendered directly inside raster images would not be recoverable as editable text.

Recommended review: visually inspect source images against the Markdown inventory to confirm no important labels, warnings, steps, or captions were missed.

## Medium Priority

### Audio file is present but not mapped to a specific slide

Asset: `audios/a05cfc99-704a-43d8-9d59-24422ba3f616.mpga`

Detected raw actions:

- `32nS8S33QMoZdLREY40c5` (`EJEMPLO ENG.mpga`)
- `L1mB1XMcfTQUsmEfIsnP0` (`EJEMPLO ENG.mpga`)
- `yBzoDlieJJr7cWgqZR5Y9` (`EJEMPLO ENG.mpga`)

Why it matters: the audio file is referenced in raw actions and by hidden/preload audio markup, but no specific recovered page could be confidently assigned as its source.

Recommended review: listen to the file and decide whether it contains real guide content, placeholder audio, narration, or unused template material.

### One mapped zoom interaction needs visual review

Source: `036 Snorkel Placement`

Detected interaction:

- Image `da456e97-08a2-4212-a69a-461e25ef3989`, source `images/1716e47c-11bb-4252-9a98-7b0978ea6b5d.png`, has a `zoom` action.

Why it matters: zoom interactions can indicate that a diagram/image contains important detail not obvious from text extraction.

Recommended review: inspect the image and the original Genially behavior if possible.

### SVG icon/shape meaning is not always recoverable

Sources: pages with SVG navigation, popup triggers, close buttons, or visual markers.

Why it matters: SVG records often contain source references and positions but not semantic labels.

Recommended review: visually inspect SVG-based controls and confirm whether any icons carry educational meaning rather than only navigation meaning.

### Raw Genially/template external links

Detected links:

- `https://www.linkedin.com/company/geniallyofficial/`
- `https://twitter.com/genially_es/`
- `https://www.instagram.com/genially_official/`
- `https://www.youtube.com/channel/UCtq6w3zpUc5tQYEC6Q8pImg`
- `https://www.facebook.com/Genially/`

Why it matters: these raw `openLink` actions appear to be Genially/template links and are not clearly attached to recovered slide objects.

Recommended review: confirm they are not intended Oceans Optics links before excluding them from future content.

### Unused SVG assets

Assets:

- `images/genially-text-2.svg`
- `images/mosca-2.svg`

Why it matters: these were not referenced by decoded slide/image data.

Recommended review: inspect visually before deciding they are template leftovers.

## Low Priority

### Source spelling and terminology issues preserved

Examples:

- `Enviroment`
- `Attatching`
- `Open Heal Fins`
- `Equalizing and Decent`
- `Exposure Protectiom`
- `Reccomened simming`

Why it matters: extraction preserved original wording exactly where possible. These should be corrected only during a later rewrite/editing stage, not in the archive.

Recommended review: keep a spelling/terminology cleanup list for the future Learning Hub rewrite.

### Popup names are sometimes generic or blank

Sources: several popup/modal slides have original Genially names like `Copy`, blank names, or repeated generic names.

Why it matters: page titles in the archive were inferred from visible text, not always from Genially slide names.

Recommended review: use the Markdown title and source ID together when tracing popup content back to the original deck.

### No local video content recovered

Source: `Videos` array and generated page files.

Flag: no local video objects were recovered.

Why it matters: if the old guide appeared to contain video-like motion, it may have been GIF/image animation or runtime animation rather than video.

Recommended review: inspect animated GIFs and any original runtime behavior if motion/animation meaning matters.

## Publication Readiness Note

The extracted archive is suitable as preserved source material. It is not publication-ready educational copy. High-stakes safety, medical, rescue, and emergency guidance should be reviewed by qualified humans before being transformed into customer-facing Learning Hub lessons.
