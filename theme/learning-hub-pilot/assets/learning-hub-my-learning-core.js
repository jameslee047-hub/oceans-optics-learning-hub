/*
 * Learning Hub Phase B, Checkpoint 3 -- "My Learning" dashboard.
 *
 * Pure data-preparation logic for the My Learning page: no DOM, no
 * fetch, no window/document access anywhere in this file. Takes the
 * published lesson catalogue (learning-hub-catalogue-data.js) and the raw
 * GET /api/progress response and derives everything the dashboard renders.
 * Kept separate from learning-hub-my-learning.js (the DOM-wiring/rendering
 * script) specifically so it's unit-testable the same way this repo's
 * backend logic is: see theme/learning-hub-pilot/tests/learning-hub-my-
 * learning-core.test.js, run with plain `node --test` -- no browser, no
 * bundler.
 *
 * Every function defends against a missing/malformed progress payload
 * (null, wrong shape, non-array fields, unknown lesson_ids) by falling
 * back to empty/zero results rather than throwing -- a broken or partial
 * API response must degrade the dashboard, never crash the page.
 *
 * Never invents progress: every number here is derived only from the
 * catalogue (the actual published lesson list) and the real progress rows
 * passed in. A lesson_id present in progress but absent from the catalogue
 * (a draft/removed/internal lesson) is ignored everywhere.
 *
 * UMD-lite export, matching the existing dual Node/browser pattern already
 * used by lens-calculator-v5.js in this same assets folder: a classic
 * `<script>` tag in the theme attaches window.OOLearningHubMyLearningCore;
 * `require()` from a Node test gets the same object via module.exports.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module !== null && typeof module.exports !== "undefined") {
    module.exports = api;
  } else {
    root.OOLearningHubMyLearningCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function isPlainArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
  }

  // Defends against a missing/malformed GET /api/progress response --
  // always returns { lessons: [], quizzes: [] } shaped arrays, regardless
  // of what was actually passed in.
  function normalizeProgress(progress) {
    var lessons = progress && isPlainArray(progress.lessons) ? progress.lessons : [];
    var quizzes = progress && isPlainArray(progress.quizzes) ? progress.quizzes : [];
    return { lessons: lessons, quizzes: quizzes };
  }

  function normalizeCatalogue(catalogue) {
    var categories = catalogue && isPlainArray(catalogue.categories) ? catalogue.categories : [];
    var lessons = catalogue && isPlainArray(catalogue.lessons) ? catalogue.lessons : [];
    return { categories: categories, lessons: lessons };
  }

  function parseTimestamp(value) {
    if (!value) return null;
    var ms = Date.parse(value);
    return isNaN(ms) ? null : ms;
  }

  // { lesson_id -> lesson_progress row } and { lesson_id -> knowledge_check_results row },
  // restricted to rows whose lesson_id actually exists in the published catalogue.
  function indexProgressByCatalogueLesson(catalogue, progress) {
    var lessonById = {};
    catalogue.lessons.forEach(function (lesson) {
      lessonById[lesson.lesson_id] = lesson;
    });

    var lessonProgressById = {};
    progress.lessons.forEach(function (row) {
      if (row && lessonById[row.lesson_id]) lessonProgressById[row.lesson_id] = row;
    });

    var quizResultById = {};
    progress.quizzes.forEach(function (row) {
      if (row && lessonById[row.lesson_id]) quizResultById[row.lesson_id] = row;
    });

    return { lessonById: lessonById, lessonProgressById: lessonProgressById, quizResultById: quizResultById };
  }

  function percentOf(count, total) {
    if (!total) return 0;
    return Math.round((count / total) * 100);
  }

  // Small derived UI helper (not a progress calculation): the category
  // card CTA copy based purely on that category's own percent -- 0% hasn't
  // been started, 100% is done (still linkable to review), anything in
  // between is in progress.
  function categoryActionLabel(percent) {
    if (percent >= 100) return "View category";
    if (percent > 0) return "Continue category";
    return "Start category";
  }

  function computeOverallProgress(catalogue, progress) {
    catalogue = normalizeCatalogue(catalogue);
    progress = normalizeProgress(progress);
    var indexed = indexProgressByCatalogueLesson(catalogue, progress);

    var completedCount = 0;
    catalogue.lessons.forEach(function (lesson) {
      var row = indexed.lessonProgressById[lesson.lesson_id];
      if (row && row.completed_at) completedCount += 1;
    });

    var totalCount = catalogue.lessons.length;
    return { completedCount: completedCount, totalCount: totalCount, percent: percentOf(completedCount, totalCount) };
  }

  function computeCategoryProgress(catalogue, progress) {
    catalogue = normalizeCatalogue(catalogue);
    progress = normalizeProgress(progress);
    var indexed = indexProgressByCatalogueLesson(catalogue, progress);

    return catalogue.categories.map(function (category) {
      var lessonsInCategory = catalogue.lessons.filter(function (lesson) {
        return lesson.category_handle === category.handle;
      });
      var completed = lessonsInCategory.filter(function (lesson) {
        var row = indexed.lessonProgressById[lesson.lesson_id];
        return !!(row && row.completed_at);
      }).length;
      var total = lessonsInCategory.length;

      return {
        handle: category.handle,
        title: category.title,
        completed: completed,
        total: total,
        percent: percentOf(completed, total)
      };
    });
  }

  // Priority: (1) the most recently viewed lesson that isn't complete yet
  // (resume it); (2) if every viewed lesson is complete, the first
  // not-yet-started lesson in catalogue order (start the next one);
  // (3) if there is nothing left to view or start, null -- the dashboard
  // shows a completed-everything state instead of a bogus CTA.
  function pickContinueLearning(catalogue, progress) {
    catalogue = normalizeCatalogue(catalogue);
    progress = normalizeProgress(progress);
    var indexed = indexProgressByCatalogueLesson(catalogue, progress);
    var categoryTitleByHandle = {};
    catalogue.categories.forEach(function (category) {
      categoryTitleByHandle[category.handle] = category.title;
    });

    function toResult(lesson, reason) {
      return {
        lesson_id: lesson.lesson_id,
        handle: lesson.handle,
        title: lesson.title,
        category_handle: lesson.category_handle,
        category_title: categoryTitleByHandle[lesson.category_handle] || "",
        reason: reason
      };
    }

    var inProgressCandidates = catalogue.lessons
      .map(function (lesson) {
        var row = indexed.lessonProgressById[lesson.lesson_id];
        if (!row || row.completed_at) return null;
        var viewedAt = parseTimestamp(row.first_viewed_at);
        return { lesson: lesson, viewedAt: viewedAt || 0 };
      })
      .filter(Boolean);

    if (inProgressCandidates.length > 0) {
      inProgressCandidates.sort(function (a, b) {
        return b.viewedAt - a.viewedAt;
      });
      return toResult(inProgressCandidates[0].lesson, "resume");
    }

    var notStarted = catalogue.lessons.find(function (lesson) {
      return !indexed.lessonProgressById[lesson.lesson_id];
    });
    if (notStarted) return toResult(notStarted, "start");

    return null;
  }

  // { completed: [...], inProgress: [...], notStarted: [...] } -- each
  // entry carries enough catalogue metadata (title/category) to render
  // without a second lookup.
  function summarizeLessons(catalogue, progress) {
    catalogue = normalizeCatalogue(catalogue);
    progress = normalizeProgress(progress);
    var indexed = indexProgressByCatalogueLesson(catalogue, progress);
    var categoryTitleByHandle = {};
    catalogue.categories.forEach(function (category) {
      categoryTitleByHandle[category.handle] = category.title;
    });

    var completed = [];
    var inProgress = [];
    var notStarted = [];

    catalogue.lessons.forEach(function (lesson) {
      var row = indexed.lessonProgressById[lesson.lesson_id];
      var entry = {
        lesson_id: lesson.lesson_id,
        handle: lesson.handle,
        title: lesson.title,
        category_handle: lesson.category_handle,
        category_title: categoryTitleByHandle[lesson.category_handle] || "",
        first_viewed_at: row ? row.first_viewed_at || null : null,
        completed_at: row ? row.completed_at || null : null
      };

      if (row && row.completed_at) completed.push(entry);
      else if (row) inProgress.push(entry);
      else notStarted.push(entry);
    });

    completed.sort(function (a, b) {
      return (parseTimestamp(b.completed_at) || 0) - (parseTimestamp(a.completed_at) || 0);
    });
    inProgress.sort(function (a, b) {
      return (parseTimestamp(b.first_viewed_at) || 0) - (parseTimestamp(a.first_viewed_at) || 0);
    });

    return { completed: completed, inProgress: inProgress, notStarted: notStarted };
  }

  // Defends the dashboard against a missing (pre-migration row), null, or
  // malformed `answers` value from GET /api/progress -- returns null
  // (meaning "no review available") unless every item is well-formed, so
  // a partially-corrupt value can never render a half-broken review
  // instead of the clean "unavailable" state. Never claims attempt
  // history: this is always exactly the one snapshot the schema stores
  // for the lesson's current result.
  function prepareAnswerReview(rawAnswers) {
    if (!isPlainArray(rawAnswers) || rawAnswers.length === 0) return null;

    var items = [];
    for (var i = 0; i < rawAnswers.length; i += 1) {
      var item = rawAnswers[i];
      if (!item || typeof item !== "object") return null;
      if (typeof item.question !== "string" || !item.question) return null;
      if (typeof item.selected !== "string") return null;
      if (typeof item.correct !== "string") return null;
      items.push({
        question_id: typeof item.question_id === "string" ? item.question_id : "q" + (i + 1),
        question: item.question,
        selected: item.selected,
        correct: item.correct,
        is_correct: item.is_correct === true
      });
    }

    return items;
  }

  // One row per lesson (the schema stores exactly one knowledge_check_results
  // row per (user, lesson) -- retaking a quiz overwrites it), so this is
  // necessarily "most recent result", never a history of attempts.
  function prepareQuizResults(catalogue, progress) {
    catalogue = normalizeCatalogue(catalogue);
    progress = normalizeProgress(progress);
    var indexed = indexProgressByCatalogueLesson(catalogue, progress);
    var categoryTitleByHandle = {};
    catalogue.categories.forEach(function (category) {
      categoryTitleByHandle[category.handle] = category.title;
    });

    var results = catalogue.lessons
      .map(function (lesson) {
        var row = indexed.quizResultById[lesson.lesson_id];
        if (!row) return null;
        var total = typeof row.total === "number" && row.total > 0 ? row.total : 0;
        var score = typeof row.score === "number" ? row.score : 0;
        return {
          lesson_id: lesson.lesson_id,
          handle: lesson.handle,
          title: lesson.title,
          category_handle: lesson.category_handle,
          category_title: categoryTitleByHandle[lesson.category_handle] || "",
          score: score,
          total: total,
          percent: percentOf(score, total),
          completed_at: row.completed_at || null,
          answerReview: prepareAnswerReview(row.answers)
        };
      })
      .filter(Boolean);

    results.sort(function (a, b) {
      return (parseTimestamp(b.completed_at) || 0) - (parseTimestamp(a.completed_at) || 0);
    });

    return results;
  }

  // Unified, most-recent-first timeline built only from timestamps the
  // schema actually has: lesson_progress.first_viewed_at/completed_at and
  // knowledge_check_results.completed_at. Entries with no parseable
  // timestamp are skipped rather than sorted arbitrarily.
  function prepareRecentActivity(catalogue, progress, options) {
    catalogue = normalizeCatalogue(catalogue);
    progress = normalizeProgress(progress);
    var limit = (options && options.limit) || 5;
    var indexed = indexProgressByCatalogueLesson(catalogue, progress);
    var titleByLessonId = {};
    catalogue.lessons.forEach(function (lesson) {
      titleByLessonId[lesson.lesson_id] = lesson.title;
    });

    var events = [];

    Object.keys(indexed.lessonProgressById).forEach(function (lessonId) {
      var row = indexed.lessonProgressById[lessonId];
      var viewedAt = parseTimestamp(row.first_viewed_at);
      if (viewedAt) events.push({ type: "viewed", lesson_id: lessonId, title: titleByLessonId[lessonId], at: viewedAt });

      var completedAt = parseTimestamp(row.completed_at);
      if (completedAt) events.push({ type: "completed", lesson_id: lessonId, title: titleByLessonId[lessonId], at: completedAt });
    });

    Object.keys(indexed.quizResultById).forEach(function (lessonId) {
      var row = indexed.quizResultById[lessonId];
      var completedAt = parseTimestamp(row.completed_at);
      if (completedAt) {
        events.push({
          type: "quiz",
          lesson_id: lessonId,
          title: titleByLessonId[lessonId],
          at: completedAt,
          score: row.score,
          total: row.total
        });
      }
    });

    events.sort(function (a, b) {
      return b.at - a.at;
    });

    return events.slice(0, limit);
  }

  function buildDashboardViewModel(catalogue, progress) {
    return {
      overall: computeOverallProgress(catalogue, progress),
      categories: computeCategoryProgress(catalogue, progress),
      continueLearning: pickContinueLearning(catalogue, progress),
      lessons: summarizeLessons(catalogue, progress),
      quizzes: prepareQuizResults(catalogue, progress),
      recentActivity: prepareRecentActivity(catalogue, progress, { limit: 5 })
    };
  }

  return {
    normalizeProgress: normalizeProgress,
    normalizeCatalogue: normalizeCatalogue,
    computeOverallProgress: computeOverallProgress,
    computeCategoryProgress: computeCategoryProgress,
    categoryActionLabel: categoryActionLabel,
    pickContinueLearning: pickContinueLearning,
    summarizeLessons: summarizeLessons,
    prepareAnswerReview: prepareAnswerReview,
    prepareQuizResults: prepareQuizResults,
    prepareRecentActivity: prepareRecentActivity,
    buildDashboardViewModel: buildDashboardViewModel
  };
});
