import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeLearningHubFunnel,
  computeDirectEntrants,
  computeContinueLearning,
  computeReturningVisitorDetail,
  computeCategoryPerformance
} from "../lib/journey-analytics.js";
import { LEARNING_CATALOGUE } from "../lib/analytics-service.js";

const iso = (s) => new Date(s).toISOString();

function hubEvent(identity, createdAt) {
  return { ...identity, event_type: "learning_hub_viewed", created_at: iso(createdAt) };
}
function categoryEvent(identity, createdAt, categoryHandle) {
  return { ...identity, event_type: "category_viewed", created_at: iso(createdAt), metadata: { category_handle: categoryHandle } };
}
function lessonEvent(identity, createdAt, lessonId) {
  return { ...identity, event_type: "lesson_viewed", created_at: iso(createdAt), lesson_id: lessonId };
}
function quizEvent(identity, createdAt, lessonId, metadata = { score: 1, total: 2 }) {
  return { ...identity, event_type: "quiz_completed", created_at: iso(createdAt), lesson_id: lessonId, metadata };
}

const ANON_A = { anonymous_visitor_id: "11111111-1111-1111-1111-111111111111" };
const ANON_B = { anonymous_visitor_id: "22222222-2222-2222-2222-222222222222" };
const ANON_C = { anonymous_visitor_id: "33333333-3333-3333-3333-333333333333" };
const USER_X = { learning_user_id: "44444444-4444-4444-4444-444444444444" };

test("computeLearningHubFunnel: a full ordered hub->category->lesson->quiz journey reaches every core stage", () => {
  const events = [
    hubEvent(ANON_A, "2026-01-01T10:00:00Z"),
    categoryEvent(ANON_A, "2026-01-01T10:01:00Z", "gear-masks-vision"),
    lessonEvent(ANON_A, "2026-01-01T10:02:00Z", "R01"),
    quizEvent(ANON_A, "2026-01-01T10:03:00Z", "R01")
  ];
  const result = computeLearningHubFunnel(events);
  assert.equal(result.cohortSize, 1);
  assert.equal(result.stages[0].visitors, 1, "hub_viewed");
  assert.equal(result.stages[1].visitors, 1, "category_viewed");
  assert.equal(result.stages[2].visitors, 1, "lesson_viewed");
  assert.equal(result.stages[3].visitors, 1, "quiz_completed");
});

test("computeLearningHubFunnel: out-of-order events do not advance the funnel -- a lesson viewed BEFORE the category stage is reached does not count as reaching stage 3", () => {
  const events = [
    hubEvent(ANON_A, "2026-01-01T10:00:00Z"),
    // Lesson viewed before the category page -- this is exactly the kind of
    // page visitors can reach without following the pipeline (e.g. a
    // bookmarked lesson URL browsed to right after the hub).
    lessonEvent(ANON_A, "2026-01-01T10:01:00Z", "R01"),
    categoryEvent(ANON_A, "2026-01-01T10:02:00Z", "gear-masks-vision")
  ];
  const result = computeLearningHubFunnel(events);
  assert.equal(result.stages[1].visitors, 1, "category_viewed is reached");
  assert.equal(result.stages[2].visitors, 0, "lesson_viewed must occur AT OR AFTER the category stage, not before it");
});

test("computeLearningHubFunnel: a lesson viewed before the hub is visited at all is excluded from the cohort's lesson stage, but a later, properly-ordered lesson view still counts", () => {
  const events = [
    lessonEvent(ANON_A, "2026-01-01T09:00:00Z", "R01"), // before hub -- not part of the ordered journey
    hubEvent(ANON_A, "2026-01-01T10:00:00Z"),
    categoryEvent(ANON_A, "2026-01-01T10:01:00Z", "gear-masks-vision"),
    lessonEvent(ANON_A, "2026-01-01T10:02:00Z", "R02") // after category -- this one counts
  ];
  const result = computeLearningHubFunnel(events);
  assert.equal(result.stages[2].visitors, 1, "the properly-ordered later lesson view reaches stage 3");
});

test("computeLearningHubFunnel: repeated views of the same page do not inflate visitor counts at any stage", () => {
  const events = [
    hubEvent(ANON_A, "2026-01-01T10:00:00Z"),
    hubEvent(ANON_A, "2026-01-01T10:05:00Z"),
    hubEvent(ANON_A, "2026-01-01T10:10:00Z"),
    categoryEvent(ANON_A, "2026-01-01T10:11:00Z", "gear-masks-vision"),
    categoryEvent(ANON_A, "2026-01-01T10:12:00Z", "gear-masks-vision")
  ];
  const result = computeLearningHubFunnel(events);
  assert.equal(result.cohortSize, 1);
  assert.equal(result.stages[1].visitors, 1);
});

test("computeLearningHubFunnel: anonymous and authenticated identities both count, and are never merged into one identity", () => {
  const events = [hubEvent(ANON_A, "2026-01-01T10:00:00Z"), hubEvent(USER_X, "2026-01-01T10:00:00Z")];
  const result = computeLearningHubFunnel(events);
  assert.equal(result.cohortSize, 2);
});

test("computeLearningHubFunnel: percentOfCohort/conversionFromPrevious/dropOffFromPrevious are computed against the right denominators", () => {
  const events = [
    hubEvent(ANON_A, "2026-01-01T10:00:00Z"),
    hubEvent(ANON_B, "2026-01-01T10:00:00Z"),
    categoryEvent(ANON_A, "2026-01-01T10:01:00Z", "gear-masks-vision")
  ];
  const result = computeLearningHubFunnel(events);
  assert.equal(result.cohortSize, 2);
  assert.equal(result.stages[1].visitors, 1);
  assert.equal(result.stages[1].percentOfCohort, 50);
  assert.equal(result.stages[1].conversionFromPrevious, 50);
  assert.equal(result.stages[1].dropOffFromPrevious, 50);
});

test("computeLearningHubFunnel: extended stages -- viewing another lesson after the quiz, then returning on a later calendar day", () => {
  const events = [
    hubEvent(ANON_A, "2026-01-01T10:00:00Z"),
    categoryEvent(ANON_A, "2026-01-01T10:01:00Z", "gear-masks-vision"),
    lessonEvent(ANON_A, "2026-01-01T10:02:00Z", "R01"),
    quizEvent(ANON_A, "2026-01-01T10:03:00Z", "R01"),
    lessonEvent(ANON_A, "2026-01-01T10:04:00Z", "R02"),
    lessonEvent(ANON_A, "2026-01-02T10:00:00Z", "R02")
  ];
  const result = computeLearningHubFunnel(events);
  assert.equal(result.stages[4].visitors, 1, "continued_learning");
  assert.equal(result.stages[5].visitors, 1, "returned_later_day");
});

test("computeLearningHubFunnel: with zero events, cohortSize is 0 and every stage is 0/0 (never NaN or fabricated)", () => {
  const result = computeLearningHubFunnel([]);
  assert.equal(result.cohortSize, 0);
  result.stages.forEach((stage) => {
    assert.equal(stage.visitors, 0);
    assert.equal(stage.percentOfCohort, 0);
  });
});

test("computeDirectEntrants: a lesson viewed before any hub visit is a direct entrant, even if the same visitor later visits the hub", () => {
  const events = [lessonEvent(ANON_A, "2026-01-01T09:00:00Z", "R01"), hubEvent(ANON_A, "2026-01-01T09:30:00Z")];
  const result = computeDirectEntrants(events);
  assert.equal(result.totalLessonViewers, 1);
  assert.equal(result.directLessonEntrants, 1);
});

test("computeDirectEntrants: hub-first visitors are never counted as direct entrants", () => {
  const events = [
    hubEvent(ANON_A, "2026-01-01T09:00:00Z"),
    categoryEvent(ANON_A, "2026-01-01T09:01:00Z", "gear-masks-vision"),
    lessonEvent(ANON_A, "2026-01-01T09:02:00Z", "R01")
  ];
  const result = computeDirectEntrants(events);
  assert.equal(result.totalLessonViewers, 1);
  assert.equal(result.directLessonEntrants, 0);
  assert.equal(result.totalCategoryViewers, 1);
  assert.equal(result.directCategoryEntrants, 0);
});

test("computeDirectEntrants: a visitor who never views the hub at all is a direct entrant for every stage they reach", () => {
  const events = [categoryEvent(ANON_C, "2026-01-01T09:00:00Z", "safety-conditions"), lessonEvent(ANON_C, "2026-01-01T09:05:00Z", "R07")];
  const result = computeDirectEntrants(events);
  assert.equal(result.directCategoryEntrants, 1);
  assert.equal(result.directLessonEntrants, 1);
});

test("computeContinueLearning: viewing a different lesson after the first one counts as continuing; repeat views of the SAME lesson do not", () => {
  const repeatOnly = [lessonEvent(ANON_A, "2026-01-01T09:00:00Z", "R01"), lessonEvent(ANON_A, "2026-01-01T09:40:00Z", "R01")];
  const repeatResult = computeContinueLearning(repeatOnly);
  assert.equal(repeatResult.lessonViewers, 1);
  assert.equal(repeatResult.viewedAnotherLessonAfterFirst, 0, "same lesson repeated is not progression");
  assert.equal(repeatResult.viewedTwoPlusDistinctLessons, 0);

  const genuineContinuation = [lessonEvent(ANON_B, "2026-01-01T09:00:00Z", "R01"), lessonEvent(ANON_B, "2026-01-01T09:40:00Z", "R02")];
  const continuedResult = computeContinueLearning(genuineContinuation);
  assert.equal(continuedResult.viewedAnotherLessonAfterFirst, 1);
  assert.equal(continuedResult.viewedTwoPlusDistinctLessons, 1);
});

test("computeContinueLearning: distinguishes same-session continuation from a later-session return using inferred 30-minute session gaps", () => {
  const sameSession = [lessonEvent(ANON_A, "2026-01-01T09:00:00Z", "R01"), lessonEvent(ANON_A, "2026-01-01T09:10:00Z", "R02")];
  const sameSessionResult = computeContinueLearning(sameSession);
  assert.equal(sameSessionResult.continuedSameSession, 1);
  assert.equal(sameSessionResult.continuedLaterSession, 0);

  const laterSession = [lessonEvent(ANON_B, "2026-01-01T09:00:00Z", "R01"), lessonEvent(ANON_B, "2026-01-01T10:00:00Z", "R02")];
  const laterSessionResult = computeContinueLearning(laterSession);
  assert.equal(laterSessionResult.continuedSameSession, 0);
  assert.equal(laterSessionResult.continuedLaterSession, 1);
});

test("computeContinueLearning: viewing another lesson after completing a Knowledge Check is tracked against quiz completers, not all lesson viewers", () => {
  const events = [
    lessonEvent(ANON_A, "2026-01-01T09:00:00Z", "R01"),
    quizEvent(ANON_A, "2026-01-01T09:05:00Z", "R01"),
    lessonEvent(ANON_A, "2026-01-01T09:10:00Z", "R02"),
    // A second visitor views a lesson but never completes a quiz.
    lessonEvent(ANON_B, "2026-01-01T09:00:00Z", "R03")
  ];
  const result = computeContinueLearning(events);
  assert.equal(result.lessonViewers, 2);
  assert.equal(result.quizCompleters, 1);
  assert.equal(result.viewedAnotherLessonAfterQuiz, 1);
  assert.equal(result.viewedAnotherLessonAfterQuizRate, 100);
});

test("computeReturningVisitorDetail: two events on the same calendar day within one session is not a later-day return, even with an inferred second session", () => {
  const events = [lessonEvent(ANON_A, "2026-01-01T09:00:00Z", "R01"), lessonEvent(ANON_A, "2026-01-01T09:45:00Z", "R02")];
  const result = computeReturningVisitorDetail(events);
  assert.equal(result.visitorsWithMultipleSessions, 1);
  assert.equal(result.visitorsReturnedOnLaterDay, 0, "same calendar day, not a later-day return");
});

test("computeReturningVisitorDetail: activity on a later calendar day is counted as a later-day return", () => {
  const events = [lessonEvent(ANON_A, "2026-01-01T09:00:00Z", "R01"), lessonEvent(ANON_A, "2026-01-02T09:00:00Z", "R02")];
  const result = computeReturningVisitorDetail(events);
  assert.equal(result.visitorsReturnedOnLaterDay, 1);
});

test("computeReturningVisitorDetail: with no events, totals are 0, not NaN or fabricated", () => {
  const result = computeReturningVisitorDetail([]);
  assert.equal(result.totalVisitors, 0);
  assert.equal(result.multipleSessionsRate, 0);
  assert.equal(result.returnedOnLaterDayRate, 0);
});

test("computeCategoryPerformance: aggregates against the real published catalogue, not hardcoded lesson titles", () => {
  const events = [
    categoryEvent(ANON_A, "2026-01-01T09:00:00Z", "gear-masks-vision"),
    lessonEvent(ANON_A, "2026-01-01T09:01:00Z", "R01"),
    quizEvent(ANON_A, "2026-01-01T09:02:00Z", "R01", { score: 2, total: 2 })
  ];
  const categories = computeCategoryPerformance(LEARNING_CATALOGUE, events);
  const gearCategory = categories.find((category) => category.handle === "gear-masks-vision");
  assert.ok(gearCategory);
  assert.equal(gearCategory.title, "Gear, Masks & Vision");
  assert.equal(gearCategory.uniqueVisitors, 1);
  assert.equal(gearCategory.uniqueLessonViewers, 1);
  assert.equal(gearCategory.knowledgeChecksCompleted, 1);
  assert.equal(gearCategory.avgQuizPercent, 100);
  assert.equal(gearCategory.visitorToLessonRate, 100);

  const otherCategory = categories.find((category) => category.handle === "safety-conditions");
  assert.equal(otherCategory.uniqueVisitors, 0);
  assert.equal(otherCategory.visitorToLessonRate, 0);
});

test("computeCategoryPerformance: visitorToLessonRate requires the lesson view to occur AT OR AFTER the category view (ordered progression, not independent counts)", () => {
  const events = [
    // Views a gear-masks-vision lesson BEFORE ever viewing that category page.
    lessonEvent(ANON_A, "2026-01-01T09:00:00Z", "R01"),
    categoryEvent(ANON_A, "2026-01-01T10:00:00Z", "gear-masks-vision")
  ];
  const categories = computeCategoryPerformance(LEARNING_CATALOGUE, events);
  const gearCategory = categories.find((category) => category.handle === "gear-masks-vision");
  assert.equal(gearCategory.uniqueVisitors, 1);
  assert.equal(gearCategory.visitorToLessonRate, 0, "the only lesson view happened before the category view, so it does not count as progression");
});

test("computeCategoryPerformance: distinctLessonsViewed counts unique lessons, not raw repeated view events", () => {
  const events = [
    lessonEvent(ANON_A, "2026-01-01T09:00:00Z", "R01"),
    lessonEvent(ANON_A, "2026-01-01T09:10:00Z", "R01"),
    lessonEvent(ANON_A, "2026-01-01T09:20:00Z", "R02")
  ];
  const categories = computeCategoryPerformance(LEARNING_CATALOGUE, events);
  const gearCategory = categories.find((category) => category.handle === "gear-masks-vision");
  assert.equal(gearCategory.lessonViewEvents, 3);
  assert.equal(gearCategory.distinctLessonsViewed, 2);
});
