// Compact manifest of the PUBLISHED Learning Hub catalogue, for the My
// Learning dashboard (learning-hub-my-learning.js /
// learning-hub-my-learning-core.js) to calculate real completion totals
// against -- never invented, never hardcoded elsewhere.
//
// Hand-derived (not auto-generated) directly from this repo's existing
// sources of truth, the same way learning-hub-lesson-id-map.js already
// is:
//   - Launched handles: shopify/data/public-launch-lessons.json
//   - Per-lesson title/category/lesson_id: shopify/data/lessons/*.json
//     (lesson_id is the R##  filename prefix; category is fields.category)
//   - Category titles: shopify/data/categories.json
//   - Per-category lesson order ("index"/"total_in_category"): sorted by
//     lesson_id ascending, per category -- the exact rule
//     learning-hub-lesson-position-data.js's own generator documents
//     ("ordered within each category by lesson_id"), verified to produce
//     identical index/total values to that live generated file.
//
// A separate small manifest (rather than reusing
// learning-hub-lesson-position-data.js or learning-hub-knowledge-check-
// data.js) because neither contains everything the dashboard needs in one
// place: the position-data file never stores a lesson's OWN title (only
// its neighbors', via previous/next), and neither file carries category
// TITLES or the internal lesson_id. Reverse-engineering a lesson's own
// title from another page's previous/next-pointer data it was never meant
// to expose would be far more fragile than one small, explicit,
// documented-provenance manifest.
//
// Deliberately NOT wired into shopify/scripts/generate-pilot-data.js: this
// file only needs to change on the rare occasion a lesson is added to or
// removed from the public launch list. Folding it into that generator
// (so it regenerates automatically alongside the other *-data.js files)
// would be the right move if/when this needs to happen more than
// occasionally -- out of scope for building the dashboard itself.
window.OOLearningHubCatalogueData = {
  categories: [
    { handle: "gear-masks-vision", title: "Gear, Masks & Vision" },
    { handle: "safety-conditions", title: "Safety & Conditions" },
    { handle: "in-water-skills", title: "In-Water Skills" }
  ],
  lessons: [
    { lesson_id: "R01", handle: "choosing-a-mask", title: "Choosing a Mask", category_handle: "gear-masks-vision", index: 1, total_in_category: 7 },
    { lesson_id: "R02", handle: "mask-fit-positioning-adjustment", title: "Mask Fit, Positioning & Adjustment", category_handle: "gear-masks-vision", index: 2, total_in_category: 7 },
    { lesson_id: "R03", handle: "mask-preparation-defogging-care", title: "Mask Preparation, Defogging & Care", category_handle: "gear-masks-vision", index: 3, total_in_category: 7 },
    { lesson_id: "R04", handle: "choosing-and-setting-up-a-snorkel", title: "Choosing and Setting Up a Snorkel", category_handle: "gear-masks-vision", index: 4, total_in_category: 7 },
    { lesson_id: "R05", handle: "choosing-fins", title: "Choosing Fins", category_handle: "gear-masks-vision", index: 5, total_in_category: 7 },
    { lesson_id: "R06", handle: "exposure-protection-staying-warm", title: "Exposure Protection & Staying Warm", category_handle: "gear-masks-vision", index: 6, total_in_category: 7 },
    { lesson_id: "R31", handle: "prescription-masks-nearsightedness-farsightedness-lens-selection", title: "Prescription Masks: Nearsightedness, Farsightedness & Lens Selection", category_handle: "gear-masks-vision", index: 7, total_in_category: 7 },
    { lesson_id: "R07", handle: "health-readiness-and-personal-responsibility", title: "Health, Readiness and Personal Responsibility", category_handle: "safety-conditions", index: 1, total_in_category: 10 },
    { lesson_id: "R08", handle: "golden-rules-for-safer-snorkeling", title: "Golden Rules for Safer Snorkeling", category_handle: "safety-conditions", index: 2, total_in_category: 10 },
    { lesson_id: "R09", handle: "surface-safety-devices", title: "Surface Safety Devices", category_handle: "safety-conditions", index: 3, total_in_category: 10 },
    { lesson_id: "R10", handle: "pre-snorkel-checklist-and-planning", title: "Pre-Snorkel Checklist and Planning", category_handle: "safety-conditions", index: 4, total_in_category: 10 },
    { lesson_id: "R11", handle: "beach-flags-and-surface-warnings", title: "Beach Flags and Surface Warnings", category_handle: "safety-conditions", index: 5, total_in_category: 10 },
    { lesson_id: "R12", handle: "currents-and-rip-currents", title: "Currents & Rip Currents", category_handle: "safety-conditions", index: 6, total_in_category: 10 },
    { lesson_id: "R13", handle: "waves-tides-and-surge", title: "Waves, Tides & Surge", category_handle: "safety-conditions", index: 7, total_in_category: 10 },
    { lesson_id: "R14", handle: "buddy-communication-and-awareness", title: "Buddy Communication and Awareness", category_handle: "safety-conditions", index: 8, total_in_category: 10 },
    { lesson_id: "R15", handle: "breath-hold-safety-co2-and-shallow-water-blackout", title: "Breath-Hold Safety, CO2 & Shallow-Water Blackout", category_handle: "safety-conditions", index: 9, total_in_category: 10 },
    { lesson_id: "R16", handle: "snorkeling-emergencies-recognition-and-preparedness", title: "Snorkeling Emergencies: Recognition & Preparedness", category_handle: "safety-conditions", index: 10, total_in_category: 10 },
    { lesson_id: "R17", handle: "entry-and-exit-techniques", title: "Entry and Exit Techniques", category_handle: "in-water-skills", index: 1, total_in_category: 6 },
    { lesson_id: "R18", handle: "clearing-your-snorkel", title: "Clearing Your Snorkel", category_handle: "in-water-skills", index: 2, total_in_category: 6 },
    { lesson_id: "R19", handle: "duck-diving-basics", title: "Duck Diving Basics", category_handle: "in-water-skills", index: 3, total_in_category: 6 },
    { lesson_id: "R20", handle: "mask-clearing-techniques", title: "Mask Clearing Techniques", category_handle: "in-water-skills", index: 4, total_in_category: 6 },
    { lesson_id: "R21", handle: "efficient-kicking-techniques", title: "Efficient Kicking Techniques", category_handle: "in-water-skills", index: 5, total_in_category: 6 },
    { lesson_id: "R23", handle: "floating-and-treading-water", title: "Floating & Treading Water", category_handle: "in-water-skills", index: 6, total_in_category: 6 }
  ]
};
