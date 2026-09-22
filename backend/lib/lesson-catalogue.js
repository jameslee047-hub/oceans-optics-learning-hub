// Compact manifest of the PUBLISHED Learning Hub catalogue, for the
// internal analytics dashboard (lib/analytics-service.js) to calculate
// real totals/titles/categories against -- never invented.
//
// This is the backend's OWN copy, not a shared module with the theme's
// theme/learning-hub-pilot/assets/learning-hub-catalogue-data.js: a Vercel
// Node function cannot import a browser-global theme asset, and the theme
// cannot import a Node backend module, so there is no way to share one
// file across that boundary. Both files are independently derived from,
// and must be kept in sync with, the SAME source of truth:
//   - Launched handles: shopify/data/public-launch-lessons.json
//   - Per-lesson title/category/lesson_id: shopify/data/lessons/*.json
//   - Category titles: shopify/data/categories.json
//   - Per-category lesson order: sorted by lesson_id ascending, per
//     category (matches learning-hub-lesson-position-data.js's own
//     generator rule).
// test/lesson-catalogue.test.js re-derives this independently from those
// same source files AND cross-checks it against the theme's copy, so the
// two can never silently drift apart.
export const LEARNING_CATALOGUE = {
  categories: [
    { handle: "gear-masks-vision", title: "Gear, Masks & Vision" },
    { handle: "safety-conditions", title: "Safety & Conditions" },
    { handle: "in-water-skills", title: "In-Water Skills" }
  ],
  lessons: [
    { lesson_id: "R01", handle: "choosing-a-mask", title: "Choosing a Mask", category_handle: "gear-masks-vision" },
    { lesson_id: "R02", handle: "mask-fit-positioning-adjustment", title: "Mask Fit, Positioning & Adjustment", category_handle: "gear-masks-vision" },
    { lesson_id: "R03", handle: "mask-preparation-defogging-care", title: "Mask Preparation, Defogging & Care", category_handle: "gear-masks-vision" },
    { lesson_id: "R04", handle: "choosing-and-setting-up-a-snorkel", title: "Choosing and Setting Up a Snorkel", category_handle: "gear-masks-vision" },
    { lesson_id: "R05", handle: "choosing-fins", title: "Choosing Fins", category_handle: "gear-masks-vision" },
    { lesson_id: "R06", handle: "exposure-protection-staying-warm", title: "Exposure Protection & Staying Warm", category_handle: "gear-masks-vision" },
    {
      lesson_id: "R31",
      handle: "prescription-masks-nearsightedness-farsightedness-lens-selection",
      title: "Prescription Masks: Nearsightedness, Farsightedness & Lens Selection",
      category_handle: "gear-masks-vision"
    },
    { lesson_id: "R07", handle: "health-readiness-and-personal-responsibility", title: "Health, Readiness and Personal Responsibility", category_handle: "safety-conditions" },
    { lesson_id: "R08", handle: "golden-rules-for-safer-snorkeling", title: "Golden Rules for Safer Snorkeling", category_handle: "safety-conditions" },
    { lesson_id: "R09", handle: "surface-safety-devices", title: "Surface Safety Devices", category_handle: "safety-conditions" },
    { lesson_id: "R10", handle: "pre-snorkel-checklist-and-planning", title: "Pre-Snorkel Checklist and Planning", category_handle: "safety-conditions" },
    { lesson_id: "R11", handle: "beach-flags-and-surface-warnings", title: "Beach Flags and Surface Warnings", category_handle: "safety-conditions" },
    { lesson_id: "R12", handle: "currents-and-rip-currents", title: "Currents & Rip Currents", category_handle: "safety-conditions" },
    { lesson_id: "R13", handle: "waves-tides-and-surge", title: "Waves, Tides & Surge", category_handle: "safety-conditions" },
    { lesson_id: "R14", handle: "buddy-communication-and-awareness", title: "Buddy Communication and Awareness", category_handle: "safety-conditions" },
    { lesson_id: "R15", handle: "breath-hold-safety-co2-and-shallow-water-blackout", title: "Breath-Hold Safety, CO2 & Shallow-Water Blackout", category_handle: "safety-conditions" },
    { lesson_id: "R16", handle: "snorkeling-emergencies-recognition-and-preparedness", title: "Snorkeling Emergencies: Recognition & Preparedness", category_handle: "safety-conditions" },
    { lesson_id: "R17", handle: "entry-and-exit-techniques", title: "Entry and Exit Techniques", category_handle: "in-water-skills" },
    { lesson_id: "R18", handle: "clearing-your-snorkel", title: "Clearing Your Snorkel", category_handle: "in-water-skills" },
    { lesson_id: "R19", handle: "duck-diving-basics", title: "Duck Diving Basics", category_handle: "in-water-skills" },
    { lesson_id: "R20", handle: "mask-clearing-techniques", title: "Mask Clearing Techniques", category_handle: "in-water-skills" },
    { lesson_id: "R21", handle: "efficient-kicking-techniques", title: "Efficient Kicking Techniques", category_handle: "in-water-skills" },
    { lesson_id: "R23", handle: "floating-and-treading-water", title: "Floating & Treading Water", category_handle: "in-water-skills" }
  ]
};

export function findLessonById(lessonId) {
  return LEARNING_CATALOGUE.lessons.find((lesson) => lesson.lesson_id === lessonId) || null;
}

export function findCategoryByHandle(handle) {
  return LEARNING_CATALOGUE.categories.find((category) => category.handle === handle) || null;
}
