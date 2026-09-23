import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeSupabase } from "./fake-supabase.js";
import {
  recordLearningEvent,
  recordLearningEventBestEffort,
  recordPageViewEvent,
  recordPageViewEventBestEffort,
  PAGE_VIEW_DEDUPE_WINDOW_MS,
  resolveDateRange,
  computeSummaryMetrics,
  computeTrackingStartedAt,
  computeLessonPerformance,
  computeQuestionAnalytics,
  questionsToReview,
  computeLearnerTable,
  computeLearnerDetail,
  KNOWN_EVENT_TYPES,
  CLIENT_REPORTABLE_EVENT_TYPES,
  isClientReportableEventType
} from "../lib/analytics-service.js";

const CATALOGUE = {
  categories: [
    { handle: "gear-masks-vision", title: "Gear, Masks & Vision" },
    { handle: "safety-conditions", title: "Safety & Conditions" }
  ],
  lessons: [
    { lesson_id: "R01", handle: "choosing-a-mask", title: "Choosing a Mask", category_handle: "gear-masks-vision" },
    { lesson_id: "R02", handle: "mask-fit-positioning-adjustment", title: "Mask Fit, Positioning & Adjustment", category_handle: "gear-masks-vision" },
    { lesson_id: "R08", handle: "golden-rules-for-safer-snorkeling", title: "Golden Rules for Safer Snorkeling", category_handle: "safety-conditions" }
  ]
};

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const USER_C = "33333333-3333-3333-3333-333333333333";

// ---------------- recordLearningEvent ----------------

test("recordLearningEvent inserts a known event type", async () => {
  const supabase = createFakeSupabase();
  await recordLearningEvent(supabase, { learningUserId: USER_A, eventType: "lesson_viewed", lessonId: "R01" });
  assert.equal(supabase.tables.learning_events.length, 1);
  assert.equal(supabase.tables.learning_events[0].event_type, "lesson_viewed");
  assert.equal(supabase.tables.learning_events[0].learning_user_id, USER_A);
});

test("recordLearningEvent rejects an unknown event type before writing anything", async () => {
  const supabase = createFakeSupabase();
  await assert.rejects(() => recordLearningEvent(supabase, { learningUserId: USER_A, eventType: "arbitrary_click" }));
  assert.equal(supabase.tables.learning_events?.length ?? 0, 0);
});

test("KNOWN_EVENT_TYPES includes exactly the suggested event vocabulary", () => {
  assert.deepEqual(
    [...KNOWN_EVENT_TYPES].sort(),
    ["category_viewed", "learning_hub_viewed", "lesson_completed", "lesson_viewed", "progress_dashboard_viewed", "quiz_completed"].sort()
  );
});

test("recordLearningEventBestEffort never throws, even for an unknown event type", async () => {
  const supabase = createFakeSupabase();
  await recordLearningEventBestEffort(supabase, { eventType: "not_a_real_event" });
  assert.equal(supabase.tables.learning_events?.length ?? 0, 0);
});

test("recordLearningEventBestEffort never throws even when the insert itself fails", async () => {
  const supabase = { from: () => ({ insert: async () => ({ error: new Error("db down") }) }) };
  await recordLearningEventBestEffort(supabase, { eventType: "lesson_viewed" });
  // No assertion needed beyond "did not throw" -- reaching this line is the test.
});

test("CLIENT_REPORTABLE_EVENT_TYPES excludes lesson_viewed/lesson_completed/quiz_completed (already recorded server-side)", () => {
  assert.deepEqual([...CLIENT_REPORTABLE_EVENT_TYPES].sort(), ["category_viewed", "learning_hub_viewed", "progress_dashboard_viewed"].sort());
  assert.equal(isClientReportableEventType("lesson_viewed"), false);
  assert.equal(isClientReportableEventType("lesson_completed"), false);
  assert.equal(isClientReportableEventType("quiz_completed"), false);
  assert.equal(isClientReportableEventType("category_viewed"), true);
});

// ---------------- recordPageViewEvent (dedup) ----------------

test("recordPageViewEvent: never invents an identity for an anonymous visitor", async () => {
  const supabase = createFakeSupabase();
  await recordPageViewEvent(supabase, { learningUserId: null, eventType: "learning_hub_viewed" });
  await recordPageViewEvent(supabase, { learningUserId: undefined, eventType: "learning_hub_viewed" });
  assert.equal(supabase.tables.learning_events?.length ?? 0, 0);
});

test("recordPageViewEvent: a rapid duplicate view within the dedupe window is not recorded twice", async () => {
  const supabase = createFakeSupabase();
  let clock = Date.parse("2026-03-01T12:00:00Z");
  const now = () => clock;

  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "lesson_viewed", lessonId: "R01", now });
  clock += 5 * 60 * 1000; // 5 minutes later -- well within the window
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "lesson_viewed", lessonId: "R01", now });

  assert.equal(supabase.tables.learning_events.length, 1, "the second, rapid view must be deduped, not recorded as a second event");
});

test("recordPageViewEvent: a genuine visit after the dedupe window elapses is recorded as a new event", async () => {
  const supabase = createFakeSupabase();
  let clock = Date.parse("2026-03-01T12:00:00Z");
  const now = () => clock;

  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "lesson_viewed", lessonId: "R01", now });
  clock += PAGE_VIEW_DEDUPE_WINDOW_MS + 1000; // just past the window
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "lesson_viewed", lessonId: "R01", now });

  assert.equal(supabase.tables.learning_events.length, 2);
});

test("recordPageViewEvent: a visit days later is always retained as a separate, legitimate event", async () => {
  const supabase = createFakeSupabase();
  let clock = Date.parse("2026-03-01T00:00:00Z");
  const now = () => clock;

  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "lesson_viewed", lessonId: "R01", now });
  clock += 3 * 24 * 60 * 60 * 1000; // 3 days later
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "lesson_viewed", lessonId: "R01", now });
  clock += 4 * 24 * 60 * 60 * 1000; // another 4 days later
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "lesson_viewed", lessonId: "R01", now });

  assert.equal(supabase.tables.learning_events.length, 3, "three real visits on different days must never be collapsed together");
});

test("recordPageViewEvent: dedupes by resource -- a duplicate view of a DIFFERENT lesson is not suppressed", async () => {
  const supabase = createFakeSupabase();
  const now = () => Date.parse("2026-03-01T12:00:00Z");
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "lesson_viewed", lessonId: "R01", now });
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "lesson_viewed", lessonId: "R02", now });
  assert.equal(supabase.tables.learning_events.length, 2);
});

test("recordPageViewEvent: dedupes category_viewed by category_handle in metadata, not just event_type", async () => {
  const supabase = createFakeSupabase();
  const now = () => Date.parse("2026-03-01T12:00:00Z");
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "category_viewed", metadata: { category_handle: "gear-masks-vision" }, now });
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "category_viewed", metadata: { category_handle: "gear-masks-vision" }, now });
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "category_viewed", metadata: { category_handle: "safety-conditions" }, now });
  assert.equal(supabase.tables.learning_events.length, 2, "same category deduped, different category recorded separately");
});

test("recordPageViewEvent: dedupes a resource-less page view (learning_hub_viewed) by user+type alone", async () => {
  const supabase = createFakeSupabase();
  const now = () => Date.parse("2026-03-01T12:00:00Z");
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "learning_hub_viewed", now });
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "learning_hub_viewed", now });
  assert.equal(supabase.tables.learning_events.length, 1);
});

test("recordPageViewEvent: different learners are never deduped against each other", async () => {
  const supabase = createFakeSupabase();
  const now = () => Date.parse("2026-03-01T12:00:00Z");
  await recordPageViewEvent(supabase, { learningUserId: USER_A, eventType: "learning_hub_viewed", now });
  await recordPageViewEvent(supabase, { learningUserId: USER_B, eventType: "learning_hub_viewed", now });
  assert.equal(supabase.tables.learning_events.length, 2);
});

test("recordPageViewEventBestEffort never throws", async () => {
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ gte: async () => ({ data: null, error: new Error("db down") }) }) }) }) }) };
  await recordPageViewEventBestEffort(supabase, { learningUserId: USER_A, eventType: "learning_hub_viewed" });
});

// ---------------- resolveDateRange ----------------

test("resolveDateRange: 'all' has no lower bound", () => {
  assert.equal(resolveDateRange("all").since, null);
});

test("resolveDateRange: 'today' starts at UTC midnight", () => {
  const fixedNow = () => Date.parse("2026-03-15T14:30:00Z");
  const range = resolveDateRange("today", fixedNow);
  assert.equal(range.since, "2026-03-15T00:00:00.000Z");
});

test("resolveDateRange: '7d' and '30d' are exactly N days before now", () => {
  const fixedNow = () => Date.parse("2026-03-15T00:00:00Z");
  assert.equal(resolveDateRange("7d", fixedNow).since, "2026-03-08T00:00:00.000Z");
  assert.equal(resolveDateRange("30d", fixedNow).since, "2026-02-13T00:00:00.000Z");
});

test("resolveDateRange: an unrecognized range falls back to 'all'", () => {
  assert.equal(resolveDateRange("bogus").range, "all");
});

// ---------------- computeSummaryMetrics ----------------

test("computeSummaryMetrics: counts are event-sourced, within range only", () => {
  const dateRange = { since: "2026-03-01T00:00:00Z", range: "7d" };
  const data = {
    users: [{ id: USER_A }, { id: USER_B }],
    events: [
      { learning_user_id: USER_A, event_type: "lesson_viewed", lesson_id: "R01", created_at: "2026-03-05T00:00:00Z" },
      { learning_user_id: USER_A, event_type: "lesson_completed", lesson_id: "R01", created_at: "2026-03-05T00:10:00Z" },
      { learning_user_id: USER_A, event_type: "quiz_completed", lesson_id: "R01", created_at: "2026-03-05T00:10:00Z", metadata: { score: 3, total: 4 } },
      { learning_user_id: USER_B, event_type: "lesson_viewed", lesson_id: "R02", created_at: "2026-02-01T00:00:00Z" } // before range
    ]
  };

  const summary = computeSummaryMetrics(data, dateRange);
  assert.equal(summary.totalLearners, 2, "total learners is always all-time");
  assert.equal(summary.activeLearners, 1, "only USER_A has in-range events");
  assert.equal(summary.lessonViews, 1);
  assert.equal(summary.lessonCompletions, 1);
  assert.equal(summary.completionRate, 100);
  assert.equal(summary.quizzesCompleted, 1);
  assert.equal(summary.avgQuizPercent, 75);
  assert.equal(summary.hasEventData, true);
});

test("computeSummaryMetrics: completion rate is 0 with no views in range, not NaN/Infinity", () => {
  const summary = computeSummaryMetrics({ users: [], events: [] }, { since: null, range: "all" });
  assert.equal(summary.completionRate, 0);
  assert.equal(summary.avgQuizPercent, null);
  assert.equal(summary.hasEventData, false);
});

test("computeSummaryMetrics: a repeat view of an already-viewed lesson still counts as activity today (does not rely on first_viewed_at)", () => {
  // The learner's FIRST-EVER view of R01 could have happened long ago (no
  // lesson_progress input is even passed here, on purpose) -- a fresh
  // lesson_viewed EVENT today is what makes them active today.
  const dateRange = { since: "2026-03-01T00:00:00Z", range: "today" };
  const summary = computeSummaryMetrics(
    { users: [{ id: USER_A }], events: [{ learning_user_id: USER_A, event_type: "lesson_viewed", lesson_id: "R01", created_at: "2026-03-01T12:00:00Z" }] },
    dateRange
  );
  assert.equal(summary.activeLearners, 1);
  assert.equal(summary.lessonViews, 1);
});

test("computeSummaryMetrics: returningLearners is null (not 0) when there is no event history at all", () => {
  const summary = computeSummaryMetrics({ users: [{ id: USER_A }], events: [] }, { since: "2026-03-01T00:00:00Z", range: "7d" });
  assert.equal(summary.returningLearners, null);
});

test("computeSummaryMetrics: returningLearners is null for the 'all time' range (no 'before' to compare against)", () => {
  const summary = computeSummaryMetrics(
    { users: [{ id: USER_A }], events: [{ learning_user_id: USER_A, created_at: "2026-01-01T00:00:00Z" }] },
    { since: null, range: "all" }
  );
  assert.equal(summary.returningLearners, null);
});

test("computeSummaryMetrics: identifies a returning learner via prior events, and excludes a first-timer", () => {
  const dateRange = { since: "2026-03-01T00:00:00Z", range: "7d" };
  const data = {
    users: [{ id: USER_A }, { id: USER_B }],
    events: [
      { learning_user_id: USER_A, event_type: "lesson_viewed", lesson_id: "R01", created_at: "2026-02-01T00:00:00Z" }, // before the range: USER_A is returning
      { learning_user_id: USER_A, event_type: "lesson_viewed", lesson_id: "R01", created_at: "2026-03-05T00:00:00Z" },
      { learning_user_id: USER_B, event_type: "lesson_viewed", lesson_id: "R02", created_at: "2026-03-05T00:00:00Z" } // only during the range: USER_B is not returning
    ]
  };
  const summary = computeSummaryMetrics(data, dateRange);
  assert.equal(summary.returningLearners, 1);
});

test("computeSummaryMetrics: repeated legitimate visits on different days are all retained as separate active-learner signal", () => {
  const dateRange = { since: "2026-03-01T00:00:00Z", range: "30d" };
  const events = [
    { learning_user_id: USER_A, event_type: "lesson_viewed", lesson_id: "R01", created_at: "2026-03-02T00:00:00Z" },
    { learning_user_id: USER_A, event_type: "lesson_viewed", lesson_id: "R02", created_at: "2026-03-10T00:00:00Z" },
    { learning_user_id: USER_A, event_type: "lesson_viewed", lesson_id: "R08", created_at: "2026-03-20T00:00:00Z" }
  ];
  const summary = computeSummaryMetrics({ users: [{ id: USER_A }], events }, dateRange);
  assert.equal(summary.lessonViews, 3, "three separate day visits must all be counted, not deduped away by this aggregation layer");
});

test("computeSummaryMetrics: tolerates missing/malformed input", () => {
  const summary = computeSummaryMetrics({}, { since: null, range: "all" });
  assert.equal(summary.totalLearners, 0);
  assert.equal(summary.activeLearners, 0);
});

// ---------------- computeTrackingStartedAt ----------------

test("computeTrackingStartedAt: null when there are no events at all", () => {
  assert.equal(computeTrackingStartedAt([]), null);
  assert.equal(computeTrackingStartedAt(null), null);
});

test("computeTrackingStartedAt: the earliest created_at across all events", () => {
  const events = [{ created_at: "2026-03-10T00:00:00Z" }, { created_at: "2026-02-01T00:00:00Z" }, { created_at: "2026-03-01T00:00:00Z" }];
  assert.equal(computeTrackingStartedAt(events), "2026-02-01T00:00:00.000Z");
});

// ---------------- computeLessonPerformance ----------------

test("computeLessonPerformance: state-based learnersStarted/completions/rate, event-based viewEvents/uniqueViewersFromEvents, kept clearly separate", () => {
  const lessonProgress = [
    { user_id: USER_A, lesson_id: "R01", completed_at: "2026-01-01T00:00:00Z" },
    { user_id: USER_B, lesson_id: "R01", completed_at: null }
  ];
  const quizResults = [{ user_id: USER_A, lesson_id: "R01", score: 4, total: 5, completed_at: "2026-01-01T00:00:00Z" }];
  const events = [
    { learning_user_id: USER_A, event_type: "lesson_viewed", lesson_id: "R01", created_at: "2026-01-01T00:00:00Z" },
    { learning_user_id: USER_A, event_type: "lesson_viewed", lesson_id: "R01", created_at: "2026-01-05T00:00:00Z" }, // same learner, a real second visit
    { learning_user_id: USER_C, event_type: "lesson_viewed", lesson_id: "R01", created_at: "2026-01-02T00:00:00Z" }
  ];

  const performance = computeLessonPerformance(CATALOGUE, lessonProgress, quizResults, events);
  const r01 = performance.find((l) => l.lesson_id === "R01");
  assert.equal(r01.learnersStarted, 2, "STATE: distinct learners with a lesson_progress row, all-time");
  assert.equal(r01.completions, 1);
  assert.equal(r01.completionRate, 50);
  assert.equal(r01.viewEvents, 3, "EVENTS: total view occurrences, can exceed learnersStarted");
  assert.equal(r01.uniqueViewersFromEvents, 2, "EVENTS: distinct learners with a view event (USER_A, USER_C)");
  assert.equal(r01.quizCount, 1);
  assert.equal(r01.avgQuizPercent, 80);

  const r02 = performance.find((l) => l.lesson_id === "R02");
  assert.equal(r02.learnersStarted, 0);
  assert.equal(r02.completionRate, 0);
  assert.equal(r02.viewEvents, 0);
  assert.equal(r02.uniqueViewersFromEvents, 0);
  assert.equal(r02.avgQuizPercent, null);
});

test("computeLessonPerformance: learnersStarted/completions remain accurate even with zero events (pre-tracking history)", () => {
  const lessonProgress = [{ user_id: USER_A, lesson_id: "R01", completed_at: "2020-01-01T00:00:00Z" }];
  const performance = computeLessonPerformance(CATALOGUE, lessonProgress, [], []);
  const r01 = performance.find((l) => l.lesson_id === "R01");
  assert.equal(r01.learnersStarted, 1);
  assert.equal(r01.completions, 1);
  assert.equal(r01.completionRate, 100);
  assert.equal(r01.viewEvents, 0, "no fabricated event count just because state history predates tracking");
});

test("computeLessonPerformance: mostMissedQuestion is null when no quiz row has an answers snapshot", () => {
  const quizResults = [{ user_id: USER_A, lesson_id: "R01", score: 1, total: 1, completed_at: "2026-01-01T00:00:00Z" }];
  const performance = computeLessonPerformance(CATALOGUE, [], quizResults);
  assert.equal(performance.find((l) => l.lesson_id === "R01").mostMissedQuestion, null);
});

test("computeLessonPerformance: mostMissedQuestion identifies the question with the most incorrect answers", () => {
  const quizResults = [
    {
      user_id: USER_A,
      lesson_id: "R01",
      score: 1,
      total: 2,
      answers: [
        { question_id: "q1", question: "Q1?", selected: "Wrong", correct: "Right", is_correct: false },
        { question_id: "q2", question: "Q2?", selected: "Right", correct: "Right", is_correct: true }
      ]
    },
    {
      user_id: USER_B,
      lesson_id: "R01",
      score: 0,
      total: 2,
      answers: [
        { question_id: "q1", question: "Q1?", selected: "Wrong", correct: "Right", is_correct: false },
        { question_id: "q2", question: "Q2?", selected: "Wrong2", correct: "Right", is_correct: false }
      ]
    }
  ];
  const performance = computeLessonPerformance(CATALOGUE, [], quizResults);
  const missed = performance.find((l) => l.lesson_id === "R01").mostMissedQuestion;
  assert.equal(missed.question_id, "q1");
  assert.equal(missed.incorrectCount, 2);
  assert.equal(missed.sampleSize, 2);
});

// ---------------- computeQuestionAnalytics ----------------

test("computeQuestionAnalytics: percent correct/incorrect and most common incorrect answer", () => {
  const quizResults = [
    {
      user_id: USER_A,
      lesson_id: "R01",
      answers: [{ question_id: "q1", question: "Q1?", selected: "A", correct: "C", is_correct: false }]
    },
    {
      user_id: USER_B,
      lesson_id: "R01",
      answers: [{ question_id: "q1", question: "Q1?", selected: "A", correct: "C", is_correct: false }]
    },
    {
      user_id: USER_A,
      lesson_id: "R01",
      answers: [{ question_id: "q1", question: "Q1?", selected: "C", correct: "C", is_correct: true }]
    }
  ];
  const questions = computeQuestionAnalytics(CATALOGUE, quizResults);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].answeredCount, 3);
  assert.equal(questions[0].percentCorrect, 33);
  assert.equal(questions[0].percentIncorrect, 67);
  assert.equal(questions[0].mostCommonIncorrectAnswer, "A");
});

test("computeQuestionAnalytics: ignores legacy rows with no answers snapshot entirely (no fabricated stats)", () => {
  const quizResults = [{ user_id: USER_A, lesson_id: "R01", score: 3, total: 4, completed_at: "2026-01-01T00:00:00Z" }];
  assert.deepEqual(computeQuestionAnalytics(CATALOGUE, quizResults), []);
});

test("computeQuestionAnalytics: ignores answers for a lesson not in the published catalogue", () => {
  const quizResults = [
    { user_id: USER_A, lesson_id: "R99", answers: [{ question_id: "q1", question: "Q?", selected: "A", correct: "B", is_correct: false }] }
  ];
  assert.deepEqual(computeQuestionAnalytics(CATALOGUE, quizResults), []);
});

test("questionsToReview: only includes questions with at least one incorrect answer, sorted worst-first", () => {
  const questions = [
    { question_id: "q1", percentIncorrect: 0, answeredCount: 5 },
    { question_id: "q2", percentIncorrect: 80, answeredCount: 5 },
    { question_id: "q3", percentIncorrect: 20, answeredCount: 5 }
  ];
  const toReview = questionsToReview(questions);
  assert.deepEqual(
    toReview.map((q) => q.question_id),
    ["q2", "q3"]
  );
});

// ---------------- computeLearnerTable ----------------

test("computeLearnerTable: completion percent is against the whole catalogue, not just started lessons", () => {
  const users = [{ id: USER_A, shopify_customer_id: "555000111" }];
  const lessonProgress = [{ user_id: USER_A, lesson_id: "R01", first_viewed_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-01T00:05:00Z" }];
  const table = computeLearnerTable(CATALOGUE, users, lessonProgress, []);
  assert.equal(table[0].lessons_completed, 1);
  assert.equal(table[0].completion_percent, 33, "1 of 3 catalogue lessons");
});

test("computeLearnerTable: last_activity_at is the most recent of all their timestamps", () => {
  const users = [{ id: USER_A, shopify_customer_id: "555000111" }];
  const lessonProgress = [{ user_id: USER_A, lesson_id: "R01", first_viewed_at: "2026-01-01T00:00:00Z", completed_at: null }];
  const quizResults = [{ user_id: USER_A, lesson_id: "R08", score: 1, total: 1, completed_at: "2026-02-01T00:00:00Z" }];
  const table = computeLearnerTable(CATALOGUE, users, lessonProgress, quizResults);
  assert.equal(table[0].last_activity_at, "2026-02-01T00:00:00Z");
});

test("computeLearnerTable: a learner with no activity has null last_activity_at and 0s elsewhere", () => {
  const users = [{ id: USER_A, shopify_customer_id: "555000111" }];
  const table = computeLearnerTable(CATALOGUE, users, [], []);
  assert.equal(table[0].last_activity_at, null);
  assert.equal(table[0].avg_quiz_percent, null);
  assert.equal(table[0].completion_percent, 0);
});

// ---------------- computeLearnerDetail ----------------

test("computeLearnerDetail: separates completed vs in-progress lessons and includes answer review", () => {
  const user = { id: USER_A, shopify_customer_id: "555000111" };
  const lessonProgress = [
    { user_id: USER_A, lesson_id: "R01", first_viewed_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-01T00:05:00Z" },
    { user_id: USER_A, lesson_id: "R02", first_viewed_at: "2026-01-02T00:00:00Z", completed_at: null }
  ];
  const answers = [{ question_id: "q1", question: "Q?", selected: "A", correct: "A", is_correct: true }];
  const quizResults = [{ user_id: USER_A, lesson_id: "R01", score: 1, total: 1, completed_at: "2026-01-01T00:05:00Z", answers }];

  const detail = computeLearnerDetail(CATALOGUE, user, lessonProgress, quizResults, []);
  assert.equal(detail.overall.completedCount, 1);
  assert.equal(detail.overall.totalCount, 3);
  assert.equal(detail.completedLessons.length, 1);
  assert.equal(detail.completedLessons[0].lesson_id, "R01");
  assert.equal(detail.inProgressLessons.length, 1);
  assert.equal(detail.inProgressLessons[0].lesson_id, "R02");
  assert.deepEqual(detail.quizzes[0].answers, answers);
});

test("computeLearnerDetail: a legacy quiz row with no answers snapshot still appears, with answers: null", () => {
  const user = { id: USER_A, shopify_customer_id: "555000111" };
  const quizResults = [{ user_id: USER_A, lesson_id: "R01", score: 2, total: 4, completed_at: "2026-01-01T00:00:00Z" }];
  const detail = computeLearnerDetail(CATALOGUE, user, [], quizResults, []);
  assert.equal(detail.quizzes.length, 1);
  assert.equal(detail.quizzes[0].answers, null);
});

test("computeLearnerDetail: timeline includes only this learner's events, most recent first, and never a JWT/token field", () => {
  const user = { id: USER_A, shopify_customer_id: "555000111" };
  const events = [
    { learning_user_id: USER_A, event_type: "lesson_viewed", lesson_id: "R01", created_at: "2026-01-01T00:00:00Z" },
    { learning_user_id: USER_A, event_type: "lesson_completed", lesson_id: "R01", created_at: "2026-01-02T00:00:00Z" },
    { learning_user_id: USER_B, event_type: "lesson_viewed", lesson_id: "R02", created_at: "2026-01-03T00:00:00Z" }
  ];
  const detail = computeLearnerDetail(CATALOGUE, user, [], [], events);
  assert.equal(detail.timeline.length, 2);
  assert.equal(detail.timeline[0].event_type, "lesson_completed");
  assert.equal(JSON.stringify(detail).toLowerCase().includes("token"), false);
});
