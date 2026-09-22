// Guards backend/lib/lesson-catalogue.js against drifting from BOTH its
// own documented source of truth (shopify/data/*.json) and the theme's
// independently-maintained copy (theme/learning-hub-pilot/assets/
// learning-hub-catalogue-data.js) -- see that file's own header comment
// for why a single shared module isn't possible across the Node backend /
// browser theme boundary.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEARNING_CATALOGUE, findLessonById, findCategoryByHandle } from "../lib/lesson-catalogue.js";

const BACKEND_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.join(BACKEND_ROOT, "..");

function deriveExpectedCatalogue() {
  const launch = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "shopify/data/public-launch-lessons.json"), "utf8")).handles;
  const categories = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "shopify/data/categories.json"), "utf8"));
  const categoryTitleByHandle = {};
  categories.forEach((category) => {
    categoryTitleByHandle[category.handle] = category.fields.title;
  });

  const lessonsDir = path.join(REPO_ROOT, "shopify/data/lessons");
  const lessonByHandle = {};
  fs.readdirSync(lessonsDir)
    .filter((name) => name.endsWith(".json"))
    .forEach((fileName) => {
      const match = fileName.match(/^(R\d{2})-/);
      const data = JSON.parse(fs.readFileSync(path.join(lessonsDir, fileName), "utf8"));
      lessonByHandle[data.handle] = { lesson_id: match[1], title: data.fields.title, category_handle: data.fields.category };
    });

  const byCategory = {};
  launch.forEach((handle) => {
    const lesson = lessonByHandle[handle];
    if (!lesson) throw new Error(`public-launch-lessons.json references an unknown handle: ${handle}`);
    byCategory[lesson.category_handle] = byCategory[lesson.category_handle] || [];
    byCategory[lesson.category_handle].push({ handle, ...lesson });
  });
  Object.keys(byCategory).forEach((categoryHandle) => {
    byCategory[categoryHandle].sort((a, b) => a.lesson_id.localeCompare(b.lesson_id));
  });

  const liveCategoryHandles = ["gear-masks-vision", "safety-conditions", "in-water-skills"];
  const expected = { categories: [], lessons: [] };
  liveCategoryHandles.forEach((categoryHandle) => {
    expected.categories.push({ handle: categoryHandle, title: categoryTitleByHandle[categoryHandle] });
    (byCategory[categoryHandle] || []).forEach((lesson) => {
      expected.lessons.push({
        lesson_id: lesson.lesson_id,
        handle: lesson.handle,
        title: lesson.title,
        category_handle: categoryHandle
      });
    });
  });
  return expected;
}

function loadThemeCatalogueData() {
  const source = fs.readFileSync(
    path.join(REPO_ROOT, "theme/learning-hub-pilot/assets/learning-hub-catalogue-data.js"),
    "utf8"
  );
  const sandboxWindow = {};
  const run = new Function("window", source); // eslint-disable-line no-new-func
  run(sandboxWindow);
  return sandboxWindow.OOLearningHubCatalogueData;
}

test("lib/lesson-catalogue.js matches an independent re-derivation from shopify/data sources", () => {
  const expected = deriveExpectedCatalogue();
  assert.deepEqual(LEARNING_CATALOGUE, expected);
});

test("lib/lesson-catalogue.js's lessons/categories match the theme's independently-maintained copy exactly", () => {
  const themeCatalogue = loadThemeCatalogueData();
  assert.deepEqual(LEARNING_CATALOGUE.categories, themeCatalogue.categories);

  // The theme's copy also carries index/total_in_category (used for its
  // own lesson-position UI) that the backend has no use for -- compare
  // only the fields this backend copy actually needs, so an unrelated
  // theme-only field is never mistaken for a real drift.
  const backendLessons = LEARNING_CATALOGUE.lessons.map((lesson) => ({
    lesson_id: lesson.lesson_id,
    handle: lesson.handle,
    title: lesson.title,
    category_handle: lesson.category_handle
  }));
  const themeLessons = themeCatalogue.lessons.map((lesson) => ({
    lesson_id: lesson.lesson_id,
    handle: lesson.handle,
    title: lesson.title,
    category_handle: lesson.category_handle
  }));
  assert.deepEqual(backendLessons, themeLessons);
});

test("findLessonById / findCategoryByHandle resolve known entries and return null for unknown ones", () => {
  assert.equal(findLessonById("R01").handle, "choosing-a-mask");
  assert.equal(findLessonById("R99"), null);
  assert.equal(findCategoryByHandle("gear-masks-vision").title, "Gear, Masks & Vision");
  assert.equal(findCategoryByHandle("not-a-category"), null);
});
