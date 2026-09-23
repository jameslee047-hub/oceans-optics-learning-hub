// Core analytics aggregation for the internal admin dashboard
// (api/admin/*). Kept separate from route handlers so it can be unit
// tested against plain fixture arrays -- no real Supabase connection.
//
// STATE vs ACTIVITY, precisely:
//   - lesson_progress / knowledge_check_results are STATE: "is this lesson
//     complete right now", "what is this learner's current/latest quiz
//     result". They stay the source of truth for a learner's overall
//     progress, lessons-ever-completed, and current/latest answer review
//     -- and they still cover time periods that predate event tracking,
//     since state itself has no "since when" concept.
//   - learning_events (migrations/0004_learning_events.sql) is the
//     AUTHORITATIVE source for BEHAVIOURAL/activity metrics: active
//     learners, lesson views, lesson completions (as occurrences),
//     Knowledge Checks completed (as occurrences), and returning
//     learners. lesson_progress.first_viewed_at is NOT a substitute for
//     this -- it only records the FIRST view ever, so a learner
//     revisiting an already-viewed lesson produces no change to it at
//     all, which would silently undercount real repeat activity if used
//     for period-based activity metrics. Likewise a quiz retake replaces
//     knowledge_check_results' single row, so it cannot represent
//     "how many times was this quiz completed" -- only "what is the
//     latest result".
//   - Because of this, activity metrics are only ever as complete as
//     learning_events itself: see computeTrackingStartedAt() and the
//     `trackingStartedAt`/`hasEventData` fields computeSummaryMetrics()
//     returns, which the dashboard uses to make this limitation explicit
//     rather than presenting pre-tracking silence as "zero activity".
//
// Every function defends against missing/malformed input (null, wrong
// shape) by normalizing to empty arrays/zero results rather than
// throwing, matching the same defensive convention as
// theme/learning-hub-pilot/assets/learning-hub-my-learning-core.js.
import { LEARNING_CATALOGUE } from "./lesson-catalogue.js";

// Every event type the learning_events table's CHECK constraint allows.
export const KNOWN_EVENT_TYPES = [
  "learning_hub_viewed",
  "category_viewed",
  "lesson_viewed",
  "lesson_completed",
  "quiz_completed",
  "progress_dashboard_viewed"
];
const KNOWN_EVENT_TYPE_SET = new Set(KNOWN_EVENT_TYPES);

// The subset of KNOWN_EVENT_TYPES a client is allowed to self-report via
// POST /api/learning-event (api/learning-event.js). lesson_viewed,
// lesson_completed, and quiz_completed are deliberately EXCLUDED here --
// they are already recorded server-side, exactly once per meaningful
// occurrence, as part of the existing authenticated write endpoints
// (/api/lesson/viewed, /api/lesson/complete, /api/quiz/result) that
// already verify the underlying state change. Letting a client also
// self-report those through the generic endpoint would risk double
// counting the same occurrence.
export const CLIENT_REPORTABLE_EVENT_TYPES = ["learning_hub_viewed", "category_viewed", "progress_dashboard_viewed"];
const CLIENT_REPORTABLE_EVENT_TYPE_SET = new Set(CLIENT_REPORTABLE_EVENT_TYPES);

export const ANONYMOUS_CLIENT_REPORTABLE_EVENT_TYPES = ["learning_hub_viewed", "category_viewed", "lesson_viewed", "quiz_completed"];
const ANONYMOUS_CLIENT_REPORTABLE_EVENT_TYPE_SET = new Set(ANONYMOUS_CLIENT_REPORTABLE_EVENT_TYPES);

export function isClientReportableEventType(eventType) {
  return CLIENT_REPORTABLE_EVENT_TYPE_SET.has(eventType);
}

export function isAnonymousClientReportableEventType(eventType) {
  return ANONYMOUS_CLIENT_REPORTABLE_EVENT_TYPE_SET.has(eventType);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function percentOf(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function toMs(isoTimestamp) {
  if (!isoTimestamp) return null;
  const ms = new Date(isoTimestamp).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Records one analytics event. Deliberately narrow: event_type must be one
// of KNOWN_EVENT_TYPES (mirrors the migration's CHECK constraint -- this
// throws before ever reaching the database for anything else, "track
// meaningful learning events rather than arbitrary clicks"). Callers
// (route handlers) are responsible for treating a failure here as
// non-fatal to the actual progress write it accompanies.
export async function recordLearningEvent(
  supabase,
  { learningUserId = null, anonymousVisitorId = null, eventType, lessonId = null, metadata = null, now = Date.now }
) {
  if (!KNOWN_EVENT_TYPE_SET.has(eventType)) {
    throw new Error(`unknown_event_type:${eventType}`);
  }
  if (Boolean(learningUserId) === Boolean(anonymousVisitorId)) {
    throw new Error("event_requires_exactly_one_identity");
  }

  // created_at is stamped explicitly (rather than relying solely on the
  // column's `default now()`) so this function's notion of "when" is
  // exactly the same clock recordPageViewEvent's dedupe window check
  // already takes as an injectable `now` -- both real callers (using the
  // real Date.now) and tests (using a fixed/advancing clock) get
  // consistent, verifiable timestamps.
  const { error } = await supabase.from("learning_events").insert({
    learning_user_id: learningUserId,
    anonymous_visitor_id: anonymousVisitorId,
    event_type: eventType,
    lesson_id: lessonId,
    metadata: metadata,
    created_at: new Date(now()).toISOString()
  });
  if (error) throw error;
}

// Same as recordLearningEvent, but never throws -- analytics logging must
// never break the actual progress write (lesson viewed/completed, quiz
// recorded) it accompanies. Route handlers call this instead of
// recordLearningEvent directly and need no try/catch of their own.
export async function recordLearningEventBestEffort(supabase, params) {
  try {
    await recordLearningEvent(supabase, params);
  } catch (error) {
    console.error("recordLearningEvent failed (non-fatal)", params && params.eventType, error && error.message ? error.message : error);
  }
}

// How long a repeat of the SAME page-view-style event (same visitor, same
// event_type, same resource) is treated as one continuous visit rather
// than a new one -- long enough to absorb a page refresh or a few minutes
// of re-reading, short enough that a genuine return visit hours or days
// later is never collapsed into it. Exported so tests can reason about
// the exact boundary rather than guessing it.
export const PAGE_VIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

// Records a page-view-style event (learning_hub_viewed, category_viewed,
// lesson_viewed, progress_dashboard_viewed) with short-window
// deduplication: if this authenticated learner or anonymous visitor already
// has an event of the SAME type
// for the SAME resource within the last PAGE_VIEW_DEDUPE_WINDOW_MS, this
// is a no-op. "Resource" is `lessonId` when given, else
// `metadata.category_handle` when given, else there is no
// resource-level distinction (learning_hub_viewed/progress_dashboard_viewed
// only ever have one "resource": the page itself).
//
// Identity must be either a verified learningUserId or a consent-gated,
// random anonymousVisitorId. With neither it remains a no-op; with both it
// fails rather than merging identities.
export async function recordPageViewEvent(
  supabase,
  {
    learningUserId = null,
    anonymousVisitorId = null,
    eventType,
    lessonId = null,
    metadata = null,
    now = Date.now,
    windowMs = PAGE_VIEW_DEDUPE_WINDOW_MS
  }
) {
  if (!learningUserId && !anonymousVisitorId) return;
  if (learningUserId && anonymousVisitorId) throw new Error("event_requires_exactly_one_identity");

  const windowStartIso = new Date(now() - windowMs).toISOString();
  let recentQuery = supabase
    .from("learning_events")
    .select("id, lesson_id, metadata")
    .eq("event_type", eventType)
    .gte("created_at", windowStartIso);
  recentQuery = learningUserId
    ? recentQuery.eq("learning_user_id", learningUserId)
    : recentQuery.eq("anonymous_visitor_id", anonymousVisitorId);
  const { data: recentEvents, error: selectError } = await recentQuery;
  if (selectError) throw selectError;

  const categoryHandle = metadata && typeof metadata.category_handle === "string" ? metadata.category_handle : null;

  const isDuplicate = (recentEvents || []).some((event) => {
    if (lessonId !== null) return event.lesson_id === lessonId;
    if (categoryHandle !== null) return !!(event.metadata && event.metadata.category_handle === categoryHandle);
    return true; // no distinguishing resource -- any recent occurrence of this type is a duplicate
  });
  if (isDuplicate) return;

  await recordLearningEvent(supabase, { learningUserId, anonymousVisitorId, eventType, lessonId, metadata, now });
}

// Same as recordPageViewEvent, but never throws -- see
// recordLearningEventBestEffort for why.
export async function recordPageViewEventBestEffort(supabase, params) {
  try {
    await recordPageViewEvent(supabase, params);
  } catch (error) {
    console.error("recordPageViewEvent failed (non-fatal)", params && params.eventType, error && error.message ? error.message : error);
  }
}

// The earliest learning_events.created_at across all recorded events, or
// null if none exist yet. The dashboard uses this to show "Activity
// tracking since <date>" (or an explicit "no activity tracked yet" state)
// next to behavioural metrics, so pre-tracking silence is never presented
// as if it were complete event analytics.
export function computeTrackingStartedAt(events) {
  events = asArray(events);
  let earliestMs = null;
  events.forEach((event) => {
    const ms = toMs(event.created_at);
    if (ms === null) return;
    if (earliestMs === null || ms < earliestMs) earliestMs = ms;
  });
  return earliestMs === null ? null : new Date(earliestMs).toISOString();
}

const RANGE_MS = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000
};

// { since: ISOString|null, range } -- `since: null` means "all time" (no
// lower bound). "today" uses UTC midnight (Vercel functions run in UTC).
export function resolveDateRange(range, now = Date.now) {
  const nowMs = now();
  if (range === "today") {
    const start = new Date(nowMs);
    start.setUTCHours(0, 0, 0, 0);
    return { since: start.toISOString(), range: "today" };
  }
  if (range === "7d" || range === "30d") {
    return { since: new Date(nowMs - RANGE_MS[range]).toISOString(), range };
  }
  return { since: null, range: "all" };
}

function isWithinRange(isoTimestamp, dateRange) {
  const ms = toMs(isoTimestamp);
  if (ms === null) return false;
  if (!dateRange.since) return true;
  return ms >= toMs(dateRange.since);
}

// Pair key for deduplicating (learning_user_id, lesson_id) -- exported
// only for this file's own tests; not part of the public aggregation API.
function eventIdentity(event) {
  if (event && event.learning_user_id) return "authenticated:" + event.learning_user_id;
  if (event && event.anonymous_visitor_id) return "anonymous:" + event.anonymous_visitor_id;
  return null;
}

function pairKey(identity, lessonId) {
  return identity + "::" + lessonId;
}

// Distinct (learning_user_id, lesson_id) pairs with a lesson_viewed event
// in range, and -- among exactly those same pairs -- how many also have a
// lesson_completed event in range. This is the metric this file calls
// "lesson conversion", NOT "completion rate": raw lesson_viewed / raw
// lesson_completed EVENT COUNTS must never be divided directly, because a
// single learner can generate several lesson_viewed events for the SAME
// lesson (revisiting it) while completing it only once -- dividing raw
// counts would understate (or, with a different revisit pattern,
// overstate) conversion for reasons that have nothing to do with whether
// people actually finish lessons they view.
//
// Both the view and the completion are required to fall in the SAME
// selected range (not "completed at any later time"), which is the more
// analytically honest choice for a period-bounded metric: it is stable
// and reproducible -- re-running the report for a closed historical
// period later always gives the same number -- rather than a figure that
// keeps changing after the fact as more time passes and lets more
// completions "leak" in from after the period actually ended. The
// tradeoff is the converse and equally well-understood limitation every
// period-bounded conversion metric has: a lesson viewed right at the end
// of a short window may not have had time to also be completed within
// that same window, which understates (never overstates) conversion for
// very recent views -- the dashboard states this explicitly rather than
// hiding it.
function computeLessonConversion(eventsInRange) {
  const viewedPairs = new Set();
  const completedPairs = new Set();

  eventsInRange.forEach((event) => {
    if (!event.learning_user_id || !event.lesson_id) return;
    const key = pairKey("authenticated:" + event.learning_user_id, event.lesson_id);
    if (event.event_type === "lesson_viewed") viewedPairs.add(key);
    else if (event.event_type === "lesson_completed") completedPairs.add(key);
  });

  let uniqueViewedPairsCompleted = 0;
  viewedPairs.forEach((key) => {
    if (completedPairs.has(key)) uniqueViewedPairsCompleted += 1;
  });

  return {
    uniqueLessonPairsViewed: viewedPairs.size,
    uniqueViewedPairsCompleted,
    lessonConversionRate: viewedPairs.size > 0 ? percentOf(uniqueViewedPairsCompleted, viewedPairs.size) : 0
  };
}

// Summary metrics for the selected date range. `users` is the only STATE
// input here (for totalLearners); every behavioural number below is
// derived EXCLUSIVELY from learning_events -- never from
// lesson_progress.first_viewed_at or knowledge_check_results.completed_at,
// which cannot represent repeat activity (see this file's header comment).
//
// - totalLearners: ALWAYS all-time (a running total of registered
//   learners), regardless of the selected range. The one STATE-derived
//   number here.
// - activeLearners: distinct learning_user_id with ANY learning_events row
//   (any of the known event types counts -- all of them are curated,
//   meaningful learning actions by design) whose timestamp falls in range.
// - lessonViews / lessonCompletions: raw COUNTS of lesson_viewed /
//   lesson_completed EVENT OCCURRENCES in range -- deliberately NOT
//   deduplicated, and deliberately never divided against each other (see
//   computeLessonConversion above for why raw counts cannot produce a
//   valid rate). Use these only as "how much activity happened", never as
//   inputs to a ratio.
// - uniqueLessonPairsViewed / uniqueViewedPairsCompleted /
//   lessonConversionRate: see computeLessonConversion -- the correctly
//   deduplicated "viewed -> completed" conversion metric.
// - quizzesCompleted: count of quiz_completed EVENTS in range (each
//   retake counts as its own occurrence, unlike the STATE table's single
//   current row per lesson).
// - avgQuizPercent: averaged over the SAME quiz_completed events (using
//   the score/total captured in each event's metadata at the time), so it
//   never mixes an events-sourced count with a state-sourced average.
// - returningLearners: a learner counted in activeLearners who ALSO has
//   an event strictly before the range's start. null (not 0) when
//   learning_events has no rows at all, or the range is "all time" (no
//   "before" boundary exists to compare against) -- a metric must never
//   be shown as a real zero when there is no signal either way.
// - trackingStartedAt / hasEventData: see computeTrackingStartedAt --
//   lets the dashboard state plainly that behavioural metrics only cover
//   activity since this timestamp, never implying they are complete
//   historical analytics.
export function computeSummaryMetrics({ users, events }, dateRange) {
  users = asArray(users);
  events = asArray(events);

  const totalLearners = users.length;
  const eventsInRange = events.filter((event) => isWithinRange(event.created_at, dateRange));

  const activeLearnerIds = new Set();
  const anonymousVisitorIds = new Set();
  const visitorIdentities = new Set();
  eventsInRange.forEach((event) => {
    if (event.learning_user_id) activeLearnerIds.add(event.learning_user_id);
    if (event.anonymous_visitor_id) anonymousVisitorIds.add(event.anonymous_visitor_id);
    const identity = eventIdentity(event);
    if (identity) visitorIdentities.add(identity);
  });

  const lessonViewEvents = eventsInRange.filter((event) => event.event_type === "lesson_viewed");
  const lessonCompletedEvents = eventsInRange.filter((event) => event.event_type === "lesson_completed");
  const quizCompletedEvents = eventsInRange.filter((event) => event.event_type === "quiz_completed");

  const lessonViews = lessonViewEvents.length;
  const lessonCompletions = lessonCompletedEvents.length;
  const { uniqueLessonPairsViewed, uniqueViewedPairsCompleted, lessonConversionRate } = computeLessonConversion(eventsInRange);

  const quizzesCompleted = quizCompletedEvents.length;
  const quizPercentages = quizCompletedEvents
    .map((event) =>
      event.metadata && typeof event.metadata.score === "number" && typeof event.metadata.total === "number"
        ? percentOf(event.metadata.score, event.metadata.total)
        : null
    )
    .filter((percent) => percent !== null);
  const avgQuizPercent =
    quizPercentages.length > 0 ? Math.round(quizPercentages.reduce((sum, percent) => sum + percent, 0) / quizPercentages.length) : null;

  let returningLearners = null;
  let returningVisitors = null;
  if (events.length > 0 && dateRange.since) {
    const sinceMs = toMs(dateRange.since);
    const priorActivityUserIds = new Set();
    events.forEach((event) => {
      const ms = toMs(event.created_at);
      if (event.learning_user_id && ms !== null && ms < sinceMs) {
        priorActivityUserIds.add(event.learning_user_id);
      }
    });
    returningLearners = 0;
    activeLearnerIds.forEach((userId) => {
      if (priorActivityUserIds.has(userId)) returningLearners += 1;
    });

    const priorVisitorIdentities = new Set();
    events.forEach((event) => {
      const ms = toMs(event.created_at);
      const identity = eventIdentity(event);
      if (identity && ms !== null && ms < sinceMs) priorVisitorIdentities.add(identity);
    });
    returningVisitors = 0;
    visitorIdentities.forEach((identity) => {
      if (priorVisitorIdentities.has(identity)) returningVisitors += 1;
    });
  }

  return {
    range: dateRange.range,
    totalLearners,
    activeLearners: activeLearnerIds.size,
    visitors: visitorIdentities.size,
    anonymousVisitors: anonymousVisitorIds.size,
    authenticatedVisitors: activeLearnerIds.size,
    lessonViews,
    lessonCompletions,
    uniqueLessonPairsViewed,
    uniqueViewedPairsCompleted,
    lessonConversionRate,
    quizzesCompleted,
    avgQuizPercent,
    returningLearners,
    returningVisitors,
    trackingStartedAt: computeTrackingStartedAt(events),
    anonymousTrackingStartedAt: computeTrackingStartedAt(events.filter((event) => event.anonymous_visitor_id)),
    hasEventData: events.length > 0
  };
}

// Tallies, per question_id, how many stored answer snapshots included it
// and how many were incorrect -- only over quiz rows that actually have an
// `answers` snapshot (never fabricated from legacy score-only rows).
// Returns { question_id, question, incorrectCount, sampleSize } for the
// single most-missed question, or null if no row for this lesson has a
// snapshot at all.
function computeMostMissedQuestion(quizRowsForLesson) {
  const tally = new Map();

  quizRowsForLesson.forEach((row) => {
    if (!Array.isArray(row.answers)) return;
    row.answers.forEach((item) => {
      if (!item || typeof item.question_id !== "string") return;
      const entry = tally.get(item.question_id) || { question: item.question, incorrect: 0, total: 0 };
      entry.total += 1;
      if (item.is_correct !== true) entry.incorrect += 1;
      tally.set(item.question_id, entry);
    });
  });

  if (tally.size === 0) return null;

  let worst = null;
  tally.forEach((entry, questionId) => {
    if (!worst || entry.incorrect > worst.incorrectCount) {
      worst = { question_id: questionId, question: entry.question, incorrectCount: entry.incorrect, sampleSize: entry.total };
    }
  });
  return worst;
}

// One row per published lesson, deliberately mixing STATE and EVENT
// numbers with precise, distinct names for each -- never calling a
// state-derived count a "view":
//
//   - learnersStarted (STATE, lesson_progress): distinct learners who
//     have ever viewed this lesson, all-time, including before event
//     tracking existed. This is "has ever started", not "views".
//   - completions / completionRate (STATE, lesson_progress): all-time,
//     against learnersStarted -- unaffected by whether event tracking has
//     even begun, since completion is itself a permanent state fact.
//   - viewEvents (EVENTS, lesson_viewed): total view OCCURRENCES recorded
//     since tracking began -- can exceed learnersStarted if learners
//     revisit.
//   - uniqueViewersFromEvents (EVENTS, lesson_viewed): distinct learners
//     with at least one view event, since tracking began -- will
//     undercount learnersStarted for any lesson whose only views happened
//     before event tracking launched, by design (see
//     computeTrackingStartedAt).
//   - quizAttempts / avgQuizAttemptPercent / mostMissedQuestion are based
//     on quiz_completed EVENTS from both populations. This is attempt
//     analytics; authenticated current/latest state remains in
//     knowledge_check_results and is used only by learner-specific views.
export function computeLessonPerformance(catalogue, lessonProgress, quizResults, events) {
  lessonProgress = asArray(lessonProgress);
  quizResults = asArray(quizResults);
  events = asArray(events);
  const categoryTitleByHandle = {};
  catalogue.categories.forEach((category) => {
    categoryTitleByHandle[category.handle] = category.title;
  });

  return catalogue.lessons.map((lesson) => {
    // lesson_progress's primary key is (user_id, lesson_id), so each user
    // contributes at most one row per lesson -- row count directly gives
    // the distinct-learners-ever-started figure, no separate
    // de-duplication needed.
    const progressRows = lessonProgress.filter((row) => row.lesson_id === lesson.lesson_id);
    const quizRows = quizResults.filter((row) => row.lesson_id === lesson.lesson_id);
    const viewEventsForLesson = events.filter((event) => event.event_type === "lesson_viewed" && event.lesson_id === lesson.lesson_id);

    const learnersStarted = progressRows.length;
    const completions = progressRows.filter((row) => row.completed_at).length;
    const completionRate = percentOf(completions, learnersStarted);

    const uniqueViewerIdsFromEvents = new Set();
    viewEventsForLesson.forEach((event) => {
      const identity = eventIdentity(event);
      if (identity) uniqueViewerIdsFromEvents.add(identity);
    });

    const quizAttemptEvents = events.filter((event) => event.event_type === "quiz_completed" && event.lesson_id === lesson.lesson_id);
    const quizAttemptPercentages = quizAttemptEvents
      .map((event) =>
        event.metadata && typeof event.metadata.score === "number" && typeof event.metadata.total === "number"
          ? percentOf(event.metadata.score, event.metadata.total)
          : null
      )
      .filter((value) => value !== null);
    const quizAttempts = quizAttemptEvents.length;
    const avgQuizAttemptPercent =
      quizAttemptPercentages.length > 0
        ? Math.round(quizAttemptPercentages.reduce((sum, value) => sum + value, 0) / quizAttemptPercentages.length)
        : null;

    return {
      lesson_id: lesson.lesson_id,
      handle: lesson.handle,
      title: lesson.title,
      category_handle: lesson.category_handle,
      category_title: categoryTitleByHandle[lesson.category_handle] || "",
      learnersStarted,
      completions,
      completionRate,
      viewEvents: viewEventsForLesson.length,
      uniqueViewersFromEvents: uniqueViewerIdsFromEvents.size,
      authenticatedLatestQuizResults: quizRows.length,
      quizAttempts,
      avgQuizAttemptPercent,
      mostMissedQuestion: computeMostMissedQuestion(quizAttemptEvents.map((event) => event.metadata || {}))
    };
  });
}

// Per-lesson, per-question stats from stored answer snapshots only. Rows
// whose lesson_id isn't in the published catalogue, or that have no
// `answers` snapshot at all (legacy pre-migration rows, or a submission
// that omitted it), are skipped entirely -- never counted toward sample
// size or percentages.
//
// Accepts quiz_completed event rows (answers nested in metadata) as well
// as the earlier direct-row shape for backward-compatible pure tests.
// Dashboard aggregate question analytics passes event rows only, avoiding
// double-counting authenticated attempts against current/latest state.
export function computeQuestionAnalytics(catalogue, quizResults) {
  quizResults = asArray(quizResults);
  const categoryTitleByHandle = {};
  catalogue.categories.forEach((category) => {
    categoryTitleByHandle[category.handle] = category.title;
  });
  const lessonById = {};
  catalogue.lessons.forEach((lesson) => {
    lessonById[lesson.lesson_id] = lesson;
  });

  const byLessonThenQuestion = {};

  quizResults.forEach((row) => {
    const answers = Array.isArray(row.answers) ? row.answers : row.metadata?.answers;
    if (!Array.isArray(answers)) return;
    const lesson = lessonById[row.lesson_id];
    if (!lesson) return;

    if (!byLessonThenQuestion[row.lesson_id]) byLessonThenQuestion[row.lesson_id] = {};
    const questionsForLesson = byLessonThenQuestion[row.lesson_id];

    answers.forEach((item) => {
      if (!item || typeof item.question_id !== "string") return;

      if (!questionsForLesson[item.question_id]) {
        questionsForLesson[item.question_id] = {
          question_id: item.question_id,
          question: item.question,
          answeredCount: 0,
          correctCount: 0,
          incorrectSelections: new Map()
        };
      }
      const question = questionsForLesson[item.question_id];
      question.answeredCount += 1;
      if (item.is_correct === true) {
        question.correctCount += 1;
      } else {
        question.incorrectSelections.set(item.selected, (question.incorrectSelections.get(item.selected) || 0) + 1);
      }
    });
  });

  const results = [];
  Object.keys(byLessonThenQuestion).forEach((lessonId) => {
    const lesson = lessonById[lessonId];
    Object.values(byLessonThenQuestion[lessonId]).forEach((question) => {
      const percentCorrect = percentOf(question.correctCount, question.answeredCount);

      let mostCommonIncorrectAnswer = null;
      let bestCount = 0;
      question.incorrectSelections.forEach((count, selected) => {
        if (count > bestCount) {
          bestCount = count;
          mostCommonIncorrectAnswer = selected;
        }
      });

      results.push({
        lesson_id: lessonId,
        lesson_title: lesson.title,
        category_handle: lesson.category_handle,
        category_title: categoryTitleByHandle[lesson.category_handle] || "",
        question_id: question.question_id,
        question: question.question,
        answeredCount: question.answeredCount,
        percentCorrect,
        percentIncorrect: 100 - percentCorrect,
        mostCommonIncorrectAnswer
      });
    });
  });

  results.sort((a, b) => b.percentIncorrect - a.percentIncorrect || b.answeredCount - a.answeredCount);
  return results;
}

// The subset of computeQuestionAnalytics() worth surfacing as "needs
// review" -- has at least one wrong answer and at least `minSampleSize`
// responses. Sample size is always included in each row so a reviewer can
// judge a single-response 100%-incorrect question differently from a
// fifty-response one.
export function questionsToReview(questionAnalytics, { minSampleSize = 1 } = {}) {
  return asArray(questionAnalytics).filter((question) => question.answeredCount >= minSampleSize && question.percentIncorrect > 0);
}

// One row per registered learner, from STATE tables (this is a
// current-status table, not a behavioural one -- see routes/admin/learners.js
// for the corresponding event-derived activity figures shown alongside
// it). completion_percent is against the whole published catalogue
// (matching the customer-facing My Learning Progress dashboard's own
// definition), not against only the lessons they've started.
// `lessons_started` (not "viewed") because it is derived from
// lesson_progress -- see this file's header comment for why that is a
// STATE fact ("has this learner ever started this lesson"), not a count
// of view occurrences.
export function computeLearnerTable(catalogue, users, lessonProgress, quizResults) {
  users = asArray(users);
  lessonProgress = asArray(lessonProgress);
  quizResults = asArray(quizResults);
  const totalLessons = catalogue.lessons.length;

  return users.map((user) => {
    const progressRows = lessonProgress.filter((row) => row.user_id === user.id);
    const quizRows = quizResults.filter((row) => row.user_id === user.id);

    const lessonsCompleted = progressRows.filter((row) => row.completed_at).length;
    const quizzesCompleted = quizRows.length;
    const avgQuizPercent =
      quizzesCompleted > 0
        ? Math.round(quizRows.reduce((sum, row) => sum + percentOf(row.score, row.total), 0) / quizzesCompleted)
        : null;

    const timestamps = [];
    progressRows.forEach((row) => {
      if (row.first_viewed_at) timestamps.push(row.first_viewed_at);
      if (row.completed_at) timestamps.push(row.completed_at);
    });
    quizRows.forEach((row) => {
      if (row.completed_at) timestamps.push(row.completed_at);
    });
    const lastActivityAt = timestamps.length
      ? timestamps.reduce((latest, ts) => (toMs(ts) > toMs(latest) ? ts : latest))
      : null;

    return {
      learning_user_id: user.id,
      shopify_customer_id: user.shopify_customer_id,
      last_activity_at: lastActivityAt,
      lessons_started: progressRows.length,
      lessons_completed: lessonsCompleted,
      completion_percent: percentOf(lessonsCompleted, totalLessons),
      quizzes_completed: quizzesCompleted,
      avg_quiz_percent: avgQuizPercent
    };
  });
}

// Full detail for one learner: overall progress, completed/in-progress
// lessons, quiz results (with their answer review, if any), and a
// chronological activity timeline from learning_events (empty if none
// exist for this learner, e.g. pre-dates event logging). Never includes a
// Learning Progress JWT, a name, an email, or any contact detail -- only
// what learning_users/lesson_progress/knowledge_check_results/
// learning_events themselves store.
export function computeLearnerDetail(catalogue, user, lessonProgress, quizResults, events) {
  lessonProgress = asArray(lessonProgress);
  quizResults = asArray(quizResults);
  events = asArray(events);

  const lessonById = {};
  catalogue.lessons.forEach((lesson) => {
    lessonById[lesson.lesson_id] = lesson;
  });

  const completedLessons = [];
  const inProgressLessons = [];
  lessonProgress.forEach((row) => {
    const lesson = lessonById[row.lesson_id];
    if (!lesson) return;
    const entry = {
      lesson_id: lesson.lesson_id,
      title: lesson.title,
      category_handle: lesson.category_handle,
      first_viewed_at: row.first_viewed_at || null,
      completed_at: row.completed_at || null
    };
    if (row.completed_at) completedLessons.push(entry);
    else inProgressLessons.push(entry);
  });

  const quizzes = quizResults
    .map((row) => {
      const lesson = lessonById[row.lesson_id];
      if (!lesson) return null;
      return {
        lesson_id: row.lesson_id,
        title: lesson.title,
        score: row.score,
        total: row.total,
        percent: percentOf(row.score, row.total),
        completed_at: row.completed_at || null,
        answers: Array.isArray(row.answers) ? row.answers : null
      };
    })
    .filter(Boolean);

  const timeline = events
    .filter((event) => event.learning_user_id === user.id)
    .map((event) => ({ event_type: event.event_type, lesson_id: event.lesson_id || null, created_at: event.created_at }))
    .sort((a, b) => toMs(b.created_at) - toMs(a.created_at));

  return {
    learning_user_id: user.id,
    shopify_customer_id: user.shopify_customer_id,
    overall: {
      completedCount: completedLessons.length,
      totalCount: catalogue.lessons.length,
      percent: percentOf(completedLessons.length, catalogue.lessons.length)
    },
    completedLessons,
    inProgressLessons,
    quizzes,
    timeline
  };
}

export { LEARNING_CATALOGUE };
