/*
 * Unit tests for learning-hub-my-learning-core.js -- the pure data-prep
 * layer behind the My Learning dashboard. No DOM, no network: this loads
 * the real, unmodified asset file the same way lens-calculator-v5.test.js
 * in this directory already does (require() against the UMD export), and
 * exercises it against realistic catalogue/progress fixtures.
 *
 * Run: node --test theme/learning-hub-pilot/tests/
 */
var test = require("node:test").test;
var assert = require("node:assert/strict");
var Core = require("../assets/learning-hub-my-learning-core.js");

var CATALOGUE = {
  categories: [
    { handle: "gear-masks-vision", title: "Gear, Masks & Vision" },
    { handle: "safety-conditions", title: "Safety & Conditions" }
  ],
  lessons: [
    { lesson_id: "R01", handle: "choosing-a-mask", title: "Choosing a Mask", category_handle: "gear-masks-vision", index: 1, total_in_category: 2 },
    { lesson_id: "R02", handle: "mask-fit-positioning-adjustment", title: "Mask Fit, Positioning & Adjustment", category_handle: "gear-masks-vision", index: 2, total_in_category: 2 },
    { lesson_id: "R07", handle: "health-readiness-and-personal-responsibility", title: "Health, Readiness and Personal Responsibility", category_handle: "safety-conditions", index: 1, total_in_category: 2 },
    { lesson_id: "R08", handle: "golden-rules-for-safer-snorkeling", title: "Golden Rules for Safer Snorkeling", category_handle: "safety-conditions", index: 2, total_in_category: 2 }
  ]
};

test("computeOverallProgress: empty progress gives 0/N", function () {
  var result = Core.computeOverallProgress(CATALOGUE, { lessons: [], quizzes: [] });
  assert.deepEqual(result, { completedCount: 0, totalCount: 4, percent: 0 });
});

test("computeOverallProgress: counts only catalogue lessons with completed_at", function () {
  var progress = {
    lessons: [
      { lesson_id: "R01", first_viewed_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-02T00:00:00Z" },
      { lesson_id: "R02", first_viewed_at: "2026-01-01T00:00:00Z", completed_at: null }
    ],
    quizzes: []
  };
  var result = Core.computeOverallProgress(CATALOGUE, progress);
  assert.deepEqual(result, { completedCount: 1, totalCount: 4, percent: 25 });
});

test("computeOverallProgress: ignores a completed lesson_id that isn't in the published catalogue", function () {
  var progress = { lessons: [{ lesson_id: "R99-unpublished", completed_at: "2026-01-01T00:00:00Z" }], quizzes: [] };
  var result = Core.computeOverallProgress(CATALOGUE, progress);
  assert.equal(result.completedCount, 0);
});

test("computeOverallProgress: all lessons complete gives 100%", function () {
  var progress = {
    lessons: CATALOGUE.lessons.map(function (lesson) {
      return { lesson_id: lesson.lesson_id, first_viewed_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-02T00:00:00Z" };
    }),
    quizzes: []
  };
  var result = Core.computeOverallProgress(CATALOGUE, progress);
  assert.deepEqual(result, { completedCount: 4, totalCount: 4, percent: 100 });
});

test("computeOverallProgress: tolerates a null/malformed progress payload", function () {
  assert.deepEqual(Core.computeOverallProgress(CATALOGUE, null), { completedCount: 0, totalCount: 4, percent: 0 });
  assert.deepEqual(Core.computeOverallProgress(CATALOGUE, {}), { completedCount: 0, totalCount: 4, percent: 0 });
  assert.deepEqual(Core.computeOverallProgress(CATALOGUE, { lessons: "not-an-array", quizzes: null }), {
    completedCount: 0,
    totalCount: 4,
    percent: 0
  });
});

test("categoryActionLabel: 0% is Start category, partial is Continue category, 100% is View category", function () {
  assert.equal(Core.categoryActionLabel(0), "Start category");
  assert.equal(Core.categoryActionLabel(1), "Continue category");
  assert.equal(Core.categoryActionLabel(50), "Continue category");
  assert.equal(Core.categoryActionLabel(99), "Continue category");
  assert.equal(Core.categoryActionLabel(100), "View category");
});

test("computeCategoryProgress: per-category completed/total/percent, in catalogue category order", function () {
  var progress = {
    lessons: [
      { lesson_id: "R01", completed_at: "2026-01-01T00:00:00Z" },
      { lesson_id: "R07", completed_at: null, first_viewed_at: "2026-01-01T00:00:00Z" }
    ],
    quizzes: []
  };
  var result = Core.computeCategoryProgress(CATALOGUE, progress);
  assert.deepEqual(result, [
    { handle: "gear-masks-vision", title: "Gear, Masks & Vision", completed: 1, total: 2, percent: 50 },
    { handle: "safety-conditions", title: "Safety & Conditions", completed: 0, total: 2, percent: 0 }
  ]);
});

test("pickContinueLearning: resumes the most recently viewed, not-yet-completed lesson", function () {
  var progress = {
    lessons: [
      { lesson_id: "R01", first_viewed_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-01T00:05:00Z" },
      { lesson_id: "R02", first_viewed_at: "2026-01-03T00:00:00Z", completed_at: null },
      { lesson_id: "R07", first_viewed_at: "2026-01-02T00:00:00Z", completed_at: null }
    ],
    quizzes: []
  };
  var result = Core.pickContinueLearning(CATALOGUE, progress);
  assert.equal(result.lesson_id, "R02");
  assert.equal(result.reason, "resume");
  assert.equal(result.category_title, "Gear, Masks & Vision");
});

test("pickContinueLearning: starts the first not-started lesson once everything viewed is complete", function () {
  var progress = {
    lessons: [
      { lesson_id: "R01", first_viewed_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-01T00:05:00Z" }
    ],
    quizzes: []
  };
  var result = Core.pickContinueLearning(CATALOGUE, progress);
  assert.equal(result.lesson_id, "R02");
  assert.equal(result.reason, "start");
});

test("pickContinueLearning: null when every catalogue lesson is complete", function () {
  var progress = {
    lessons: CATALOGUE.lessons.map(function (lesson) {
      return { lesson_id: lesson.lesson_id, completed_at: "2026-01-01T00:00:00Z" };
    }),
    quizzes: []
  };
  assert.equal(Core.pickContinueLearning(CATALOGUE, progress), null);
});

test("pickContinueLearning: starts the very first catalogue lesson for a brand-new (empty) learner", function () {
  var result = Core.pickContinueLearning(CATALOGUE, { lessons: [], quizzes: [] });
  assert.equal(result.lesson_id, "R01");
  assert.equal(result.reason, "start");
});

test("summarizeLessons: buckets into completed / inProgress / notStarted correctly", function () {
  var progress = {
    lessons: [
      { lesson_id: "R01", first_viewed_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-02T00:00:00Z" },
      { lesson_id: "R02", first_viewed_at: "2026-01-03T00:00:00Z", completed_at: null }
    ],
    quizzes: []
  };
  var result = Core.summarizeLessons(CATALOGUE, progress);
  assert.equal(result.completed.length, 1);
  assert.equal(result.completed[0].lesson_id, "R01");
  assert.equal(result.inProgress.length, 1);
  assert.equal(result.inProgress[0].lesson_id, "R02");
  assert.equal(result.notStarted.length, 2);
  assert.deepEqual(
    result.notStarted.map(function (row) {
      return row.lesson_id;
    }),
    ["R07", "R08"]
  );
});

test("prepareQuizResults: maps score/total/percent per lesson, most recent first, never claims attempt history", function () {
  var progress = {
    lessons: [],
    quizzes: [
      { lesson_id: "R01", score: 3, total: 4, completed_at: "2026-01-01T00:00:00Z" },
      { lesson_id: "R08", score: 5, total: 5, completed_at: "2026-01-05T00:00:00Z" }
    ]
  };
  var result = Core.prepareQuizResults(CATALOGUE, progress);
  assert.equal(result.length, 2);
  assert.equal(result[0].lesson_id, "R08");
  assert.equal(result[0].percent, 100);
  assert.equal(result[1].lesson_id, "R01");
  assert.equal(result[1].percent, 75);
  // The result objects themselves carry no "attempts"/history concept --
  // only a single completed_at per lesson, matching the one-row-per-
  // (user, lesson) schema.
  assert.deepEqual(Object.keys(result[0]).sort(), [
    "category_handle",
    "category_title",
    "completed_at",
    "handle",
    "lesson_id",
    "percent",
    "score",
    "title",
    "total"
  ]);
});

test("prepareQuizResults: ignores a quiz result for a lesson not in the published catalogue", function () {
  var progress = { lessons: [], quizzes: [{ lesson_id: "R99-unpublished", score: 1, total: 1, completed_at: "2026-01-01T00:00:00Z" }] };
  assert.deepEqual(Core.prepareQuizResults(CATALOGUE, progress), []);
});

test("prepareRecentActivity: merges viewed/completed/quiz events, most recent first, respects the limit", function () {
  var progress = {
    lessons: [
      { lesson_id: "R01", first_viewed_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-04T00:00:00Z" },
      { lesson_id: "R02", first_viewed_at: "2026-01-05T00:00:00Z", completed_at: null }
    ],
    quizzes: [{ lesson_id: "R01", score: 4, total: 4, completed_at: "2026-01-04T00:01:00Z" }]
  };
  var result = Core.prepareRecentActivity(CATALOGUE, progress, { limit: 2 });
  assert.equal(result.length, 2);
  assert.equal(result[0].lesson_id, "R02");
  assert.equal(result[0].type, "viewed");
  assert.equal(result[1].lesson_id, "R01");
  assert.equal(result[1].type, "quiz");
});

test("prepareRecentActivity: skips rows with no parseable timestamp instead of throwing", function () {
  var progress = { lessons: [{ lesson_id: "R01", first_viewed_at: null, completed_at: undefined }], quizzes: [] };
  assert.deepEqual(Core.prepareRecentActivity(CATALOGUE, progress), []);
});

test("buildDashboardViewModel: composes all sections together for an empty (brand-new) learner", function () {
  var viewModel = Core.buildDashboardViewModel(CATALOGUE, { lessons: [], quizzes: [] });
  assert.equal(viewModel.overall.completedCount, 0);
  assert.equal(viewModel.overall.totalCount, 4);
  assert.equal(viewModel.categories.length, 2);
  assert.equal(viewModel.continueLearning.lesson_id, "R01");
  assert.equal(viewModel.lessons.notStarted.length, 4);
  assert.deepEqual(viewModel.quizzes, []);
  assert.deepEqual(viewModel.recentActivity, []);
});

test("buildDashboardViewModel: tolerates a completely missing progress payload end to end", function () {
  var viewModel = Core.buildDashboardViewModel(CATALOGUE, undefined);
  assert.equal(viewModel.overall.totalCount, 4);
  assert.equal(viewModel.overall.completedCount, 0);
  assert.equal(viewModel.continueLearning.reason, "start");
});
