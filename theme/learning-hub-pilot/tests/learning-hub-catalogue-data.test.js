/*
 * Guards learning-hub-catalogue-data.js against drifting from the sources
 * of truth it documents itself as derived from: shopify/data/lessons/*.json
 * (lesson_id/title/category), shopify/data/categories.json (category
 * titles), and shopify/data/public-launch-lessons.json (which lessons are
 * actually launched). Re-derives the expected manifest independently here
 * and diffs it against the real file -- if a lesson is ever added to or
 * removed from the launch list without updating the hand-maintained
 * manifest, this test fails instead of the dashboard silently
 * under/over-counting.
 *
 * Loads the real, unmodified data file the same way the browser does
 * (executes it with a stand-in `window`), not a re-typed copy of it.
 *
 * Run: node --test theme/learning-hub-pilot/tests/
 */
var test = require("node:test").test;
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var REPO_ROOT = path.join(__dirname, "..", "..", "..");

// Runs the real, unmodified data file in THIS realm (via the Function
// constructor, not vm.runInContext -- a separate vm context creates
// objects with a different realm's Object.prototype, which makes
// assert.deepStrictEqual fail with "same structure but not
// reference-equal" even for genuinely identical plain data).
function loadCatalogueData() {
  var source = fs.readFileSync(
    path.join(__dirname, "..", "assets", "learning-hub-catalogue-data.js"),
    "utf8"
  );
  var sandboxWindow = {};
  var run = new Function("window", source); // eslint-disable-line no-new-func
  run(sandboxWindow);
  return sandboxWindow.OOLearningHubCatalogueData;
}

function deriveExpectedCatalogue() {
  var launch = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "shopify/data/public-launch-lessons.json"), "utf8")).handles;
  var categories = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "shopify/data/categories.json"), "utf8"));
  var categoryTitleByHandle = {};
  categories.forEach(function (category) {
    categoryTitleByHandle[category.handle] = category.fields.title;
  });

  var lessonsDir = path.join(REPO_ROOT, "shopify/data/lessons");
  var lessonByHandle = {};
  fs.readdirSync(lessonsDir)
    .filter(function (name) {
      return name.endsWith(".json");
    })
    .forEach(function (fileName) {
      var match = fileName.match(/^(R\d{2})-/);
      var data = JSON.parse(fs.readFileSync(path.join(lessonsDir, fileName), "utf8"));
      lessonByHandle[data.handle] = { lesson_id: match[1], title: data.fields.title, category_handle: data.fields.category };
    });

  var byCategory = {};
  launch.forEach(function (handle) {
    var lesson = lessonByHandle[handle];
    if (!lesson) throw new Error("public-launch-lessons.json references an unknown handle: " + handle);
    byCategory[lesson.category_handle] = byCategory[lesson.category_handle] || [];
    byCategory[lesson.category_handle].push({ handle: handle, lesson_id: lesson.lesson_id, title: lesson.title });
  });
  Object.keys(byCategory).forEach(function (categoryHandle) {
    byCategory[categoryHandle].sort(function (a, b) {
      return a.lesson_id < b.lesson_id ? -1 : a.lesson_id > b.lesson_id ? 1 : 0;
    });
  });

  // The three currently-live categories, in the order the homepage/
  // lesson-position data already presents them.
  var liveCategoryHandles = ["gear-masks-vision", "safety-conditions", "in-water-skills"];

  var expected = { categories: [], lessons: [] };
  liveCategoryHandles.forEach(function (categoryHandle) {
    expected.categories.push({ handle: categoryHandle, title: categoryTitleByHandle[categoryHandle] });
    var lessonsInCategory = byCategory[categoryHandle] || [];
    lessonsInCategory.forEach(function (lesson, index) {
      expected.lessons.push({
        lesson_id: lesson.lesson_id,
        handle: lesson.handle,
        title: lesson.title,
        category_handle: categoryHandle,
        index: index + 1,
        total_in_category: lessonsInCategory.length
      });
    });
  });

  return expected;
}

test("learning-hub-catalogue-data.js matches an independent re-derivation from shopify/data sources", function () {
  var actual = loadCatalogueData();
  var expected = deriveExpectedCatalogue();
  assert.deepEqual(actual, expected);
});

test("learning-hub-catalogue-data.js contains no duplicate lesson_id or handle", function () {
  var catalogue = loadCatalogueData();
  var lessonIds = catalogue.lessons.map(function (lesson) {
    return lesson.lesson_id;
  });
  var handles = catalogue.lessons.map(function (lesson) {
    return lesson.handle;
  });
  assert.equal(new Set(lessonIds).size, lessonIds.length, "duplicate lesson_id found");
  assert.equal(new Set(handles).size, handles.length, "duplicate handle found");
});

test("learning-hub-catalogue-data.js: every lesson's category_handle is one of the listed categories", function () {
  var catalogue = loadCatalogueData();
  var categoryHandles = new Set(
    catalogue.categories.map(function (category) {
      return category.handle;
    })
  );
  catalogue.lessons.forEach(function (lesson) {
    assert.ok(categoryHandles.has(lesson.category_handle), lesson.handle + " has an unknown category_handle");
  });
});
