// Maps each lesson's PUBLIC handle (metaobject.system.handle, e.g. the
// value already in data-lesson-handle throughout this theme) to its
// STABLE INTERNAL lesson_id (R01..R31) -- the only lesson identifier the
// Learning Progress backend accepts (see backend/api/lesson/viewed.js and
// backend/migrations/0001_init.sql's lesson_id_format check: the public
// handle is deliberately never persisted or trusted as a database key).
//
// Hand-maintained, derived directly from the repo's own source of truth:
// each handle's R-number is the filename prefix in shopify/data/lessons/
// (e.g. R01-choosing-a-mask.json), filtered to exactly the handles listed
// in shopify/data/public-launch-lessons.json. If a lesson is added to or
// removed from that launch list, this file needs the matching entry
// added/removed by hand. Folding this into the existing
// shopify/scripts/generate-pilot-data.js pipeline (so it regenerates
// automatically alongside learning-hub-knowledge-check-data.js and
// learning-hub-lesson-position-data.js) would remove that manual step --
// worth doing in a later checkpoint, but out of scope for wiring
// Phase B Checkpoint 2's progress writes.
window.OOLearningHubLessonIdMap = {
  "choosing-a-mask": "R01",
  "mask-fit-positioning-adjustment": "R02",
  "mask-preparation-defogging-care": "R03",
  "choosing-and-setting-up-a-snorkel": "R04",
  "choosing-fins": "R05",
  "exposure-protection-staying-warm": "R06",
  "health-readiness-and-personal-responsibility": "R07",
  "golden-rules-for-safer-snorkeling": "R08",
  "surface-safety-devices": "R09",
  "pre-snorkel-checklist-and-planning": "R10",
  "beach-flags-and-surface-warnings": "R11",
  "currents-and-rip-currents": "R12",
  "waves-tides-and-surge": "R13",
  "buddy-communication-and-awareness": "R14",
  "breath-hold-safety-co2-and-shallow-water-blackout": "R15",
  "snorkeling-emergencies-recognition-and-preparedness": "R16",
  "entry-and-exit-techniques": "R17",
  "clearing-your-snorkel": "R18",
  "duck-diving-basics": "R19",
  "mask-clearing-techniques": "R20",
  "efficient-kicking-techniques": "R21",
  "floating-and-treading-water": "R23",
  "prescription-masks-nearsightedness-farsightedness-lens-selection": "R31"
};
