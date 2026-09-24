// Funnel / journey / category / continue-learning / returning-visitor
// analytics for the internal Learning Analytics dashboard. Kept separate
// from lib/analytics-service.js (which owns STATE-vs-EVENT summary,
// per-lesson, and per-question metrics) because everything here is about
// ORDERED sequences of events for one visitor identity rather than
// independent counts -- a different shape of computation that deserves
// its own module. Both files depend on lib/event-identity.js only, never
// on each other, so there is no import cycle.
//
// COHORT / PERIOD DEFINITION: every function here takes `eventsInRange`,
// already filtered to the dashboard's selected date range (see
// lib/analytics-service.js's resolveDateRange/isWithinRange -- "since X,
// no upper bound", the same window used by every other metric on this
// dashboard). A visitor's whole ordered journey -- entry, every
// intermediate stage, and any follow-on/return activity -- must fall
// inside that same window; an event from before `since` never counts
// toward reaching a stage, even if the visitor's later, in-range activity
// depends on it. This keeps a closed/historical period's funnel numbers
// stable: extending the window later can only ever add cohort members or
// move people further down stages, never retroactively change how an
// already-computed period read. It also means "all time" is the only
// range with full journey visibility; narrower ranges may under-count a
// journey that started before the window (that visitor simply will not
// appear in the hub-first cohort at all for that narrower range, since
// their qualifying learning_hub_viewed event falls outside it).
import { eventIdentity, toMs, percentOf, calendarDay, groupEventsByIdentity, sessionizeEvents } from "./event-identity.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// Earliest event of `eventType` at or after `afterMs` (or the earliest of
// its kind at all, when afterMs is null) matching an optional predicate.
// `events` need not be pre-filtered by type. Returns { event, ms } or null.
function firstEventAtOrAfter(events, eventType, afterMs, predicate) {
  let earliest = null;
  events.forEach((event) => {
    if (event.event_type !== eventType) return;
    if (predicate && !predicate(event)) return;
    const ms = toMs(event.created_at);
    if (ms === null) return;
    if (afterMs !== null && ms < afterMs) return;
    if (earliest === null || ms < earliest.ms) earliest = { event, ms };
  });
  return earliest;
}

// The ordered, hub-first Learning Hub funnel. Cohort = every visitor
// identity (anonymous + authenticated, never merged/stitched across
// login -- see eventIdentity) with at least one learning_hub_viewed event
// in range. A visitor advances to stage N only via an event that is BOTH
// in range AND chronologically at or after the timestamp at which they
// reached stage N-1 -- never by independently having "some event of the
// right type somewhere in range" (that would not be a genuine ordered
// funnel). Stages 5 and 6 are optional extensions past the core
// hub->category->lesson->quiz pipeline; see computeContinueLearning and
// computeReturningVisitorDetail for the same ideas computed independently
// of the hub-first cohort (i.e. also covering direct entrants).
export const FUNNEL_STAGE_DEFINITIONS = [
  { key: "hub_viewed", label: "Learning Hub viewed" },
  { key: "category_viewed", label: "Category viewed" },
  { key: "lesson_viewed", label: "Lesson viewed" },
  { key: "quiz_completed", label: "Knowledge Check completed" },
  { key: "continued_learning", label: "Viewed another lesson afterward" },
  { key: "returned_later_day", label: "Returned on a later day" }
];

export function computeLearningHubFunnel(eventsInRange) {
  eventsInRange = asArray(eventsInRange);
  const byIdentity = groupEventsByIdentity(eventsInRange);
  const stageCounts = [0, 0, 0, 0, 0, 0];

  byIdentity.forEach((identityEvents) => {
    const hub = firstEventAtOrAfter(identityEvents, "learning_hub_viewed", null);
    if (!hub) return;
    stageCounts[0] += 1;
    const hubDay = calendarDay(hub.ms);

    const category = firstEventAtOrAfter(identityEvents, "category_viewed", hub.ms);
    if (!category) return;
    stageCounts[1] += 1;

    const lesson = firstEventAtOrAfter(identityEvents, "lesson_viewed", category.ms);
    if (!lesson) return;
    stageCounts[2] += 1;

    const quiz = firstEventAtOrAfter(identityEvents, "quiz_completed", lesson.ms);
    if (!quiz) return;
    stageCounts[3] += 1;

    const firstLessonId = lesson.event.lesson_id;
    const anotherLesson = firstEventAtOrAfter(
      identityEvents,
      "lesson_viewed",
      quiz.ms,
      (event) => event.lesson_id && event.lesson_id !== firstLessonId
    );
    if (!anotherLesson) return;
    stageCounts[4] += 1;

    const returnedLaterDay = identityEvents.some((event) => {
      const day = calendarDay(toMs(event.created_at));
      return day !== null && hubDay !== null && day > hubDay;
    });
    if (!returnedLaterDay) return;
    stageCounts[5] += 1;
  });

  const cohortSize = stageCounts[0];
  const stages = FUNNEL_STAGE_DEFINITIONS.map((definition, index) => {
    const count = stageCounts[index];
    const previousCount = index === 0 ? count : stageCounts[index - 1];
    return {
      key: definition.key,
      label: definition.label,
      visitors: count,
      percentOfCohort: percentOf(count, cohortSize),
      conversionFromPrevious: index === 0 ? 100 : percentOf(count, previousCount),
      dropOffFromPrevious: index === 0 ? 0 : percentOf(previousCount - count, previousCount)
    };
  });

  return { cohortSize, stages };
}

// Visitors who reached category/lesson/quiz activity in range WITHOUT
// first viewing the Learning Hub in range (search, email, direct link,
// or a hub visit that fell outside the selected window). These are
// deliberately reported as their own totals, never folded into the
// hub-first funnel's drop-off counts -- see the module comment above and
// requirement #4 in the originating brief: a direct entrant never viewing
// /pages/learn is not a funnel failure.
export function computeDirectEntrants(eventsInRange) {
  eventsInRange = asArray(eventsInRange);
  const byIdentity = groupEventsByIdentity(eventsInRange);

  let totalCategoryViewers = 0;
  let directCategoryEntrants = 0;
  let totalLessonViewers = 0;
  let directLessonEntrants = 0;
  let totalQuizCompleters = 0;

  byIdentity.forEach((identityEvents) => {
    const hub = firstEventAtOrAfter(identityEvents, "learning_hub_viewed", null);
    const category = firstEventAtOrAfter(identityEvents, "category_viewed", null);
    const lesson = firstEventAtOrAfter(identityEvents, "lesson_viewed", null);
    const quiz = firstEventAtOrAfter(identityEvents, "quiz_completed", null);

    if (category) {
      totalCategoryViewers += 1;
      if (!hub || hub.ms > category.ms) directCategoryEntrants += 1;
    }
    if (lesson) {
      totalLessonViewers += 1;
      if (!hub || hub.ms > lesson.ms) directLessonEntrants += 1;
    }
    if (quiz) totalQuizCompleters += 1;
  });

  return { totalCategoryViewers, directCategoryEntrants, totalLessonViewers, directLessonEntrants, totalQuizCompleters };
}

// Do visitors keep going after one lesson (or after finishing a Knowledge
// Check)? Independent of the hub-first cohort -- covers direct entrants
// too. "Another lesson" always means a DIFFERENT lesson_id at a later
// timestamp; repeat views of the same lesson are never counted as
// progression. Same-session vs later-return continuation is reported only
// when it can be determined from this visitor's own event history via the
// inferred-session model (see lib/event-identity.js).
export function computeContinueLearning(eventsInRange) {
  eventsInRange = asArray(eventsInRange);
  const byIdentity = groupEventsByIdentity(eventsInRange);

  let lessonViewers = 0;
  let viewedAnotherLessonAfterFirst = 0;
  let continuedSameSession = 0;
  let continuedLaterSession = 0;
  let quizCompleters = 0;
  let viewedAnotherLessonAfterQuiz = 0;
  let viewedTwoPlusDistinctLessons = 0;
  let viewedThreePlusDistinctLessons = 0;

  byIdentity.forEach((identityEvents) => {
    const lessonViewEvents = identityEvents.filter((event) => event.event_type === "lesson_viewed" && event.lesson_id);
    if (lessonViewEvents.length === 0) return;
    lessonViewers += 1;

    const distinctLessonIds = new Set(lessonViewEvents.map((event) => event.lesson_id));
    if (distinctLessonIds.size >= 2) viewedTwoPlusDistinctLessons += 1;
    if (distinctLessonIds.size >= 3) viewedThreePlusDistinctLessons += 1;

    const firstLesson = lessonViewEvents[0];
    const firstLessonMs = toMs(firstLesson.created_at);
    const anotherAfterFirst = lessonViewEvents.find(
      (event) => event.lesson_id !== firstLesson.lesson_id && toMs(event.created_at) > firstLessonMs
    );
    if (anotherAfterFirst) {
      viewedAnotherLessonAfterFirst += 1;
      const sessions = sessionizeEvents(identityEvents);
      const firstSessionIndex = sessions.findIndex((session) => session.includes(firstLesson));
      const anotherSessionIndex = sessions.findIndex((session) => session.includes(anotherAfterFirst));
      if (firstSessionIndex !== -1 && firstSessionIndex === anotherSessionIndex) continuedSameSession += 1;
      else continuedLaterSession += 1;
    }

    const quizEvents = identityEvents.filter((event) => event.event_type === "quiz_completed" && event.lesson_id);
    if (quizEvents.length > 0) {
      quizCompleters += 1;
      const firstQuiz = quizEvents[0];
      const firstQuizMs = toMs(firstQuiz.created_at);
      const anotherAfterQuiz = lessonViewEvents.find(
        (event) => event.lesson_id !== firstQuiz.lesson_id && toMs(event.created_at) > firstQuizMs
      );
      if (anotherAfterQuiz) viewedAnotherLessonAfterQuiz += 1;
    }
  });

  return {
    lessonViewers,
    viewedAnotherLessonAfterFirst,
    viewedAnotherLessonAfterFirstRate: percentOf(viewedAnotherLessonAfterFirst, lessonViewers),
    continuedSameSession,
    continuedLaterSession,
    quizCompleters,
    viewedAnotherLessonAfterQuiz,
    viewedAnotherLessonAfterQuizRate: percentOf(viewedAnotherLessonAfterQuiz, quizCompleters),
    viewedTwoPlusDistinctLessons,
    viewedTwoPlusDistinctLessonsRate: percentOf(viewedTwoPlusDistinctLessons, lessonViewers),
    viewedThreePlusDistinctLessons,
    viewedThreePlusDistinctLessonsRate: percentOf(viewedThreePlusDistinctLessons, lessonViewers)
  };
}

// Repeat engagement WITHIN the selected period only -- multiple inferred
// sessions, or activity on 2+ distinct calendar days. This is a different,
// narrower question than lib/analytics-service.js's computeSummaryMetrics
// returningLearners/returningVisitors (which compares against activity
// BEFORE the period and is null for "all time", since there is no earlier
// point to compare against). This function instead works for every range
// including "all time", at the cost of only ever seeing repeat behaviour
// that itself falls inside the window -- a visitor whose two visits
// straddle a narrow window's edges will not be counted as a repeat here.
// Per requirement #8: never infers anonymous return behaviour from before
// anonymous tracking existed -- this simply cannot happen here, since it
// only ever looks at events that were actually recorded.
export function computeReturningVisitorDetail(eventsInRange) {
  eventsInRange = asArray(eventsInRange);
  const byIdentity = groupEventsByIdentity(eventsInRange);

  let totalVisitors = 0;
  let visitorsWithMultipleSessions = 0;
  let visitorsReturnedOnLaterDay = 0;

  byIdentity.forEach((identityEvents) => {
    totalVisitors += 1;

    const sessions = sessionizeEvents(identityEvents);
    if (sessions.length >= 2) visitorsWithMultipleSessions += 1;

    const days = new Set(identityEvents.map((event) => calendarDay(toMs(event.created_at))).filter((day) => day !== null));
    if (days.size >= 2) visitorsReturnedOnLaterDay += 1;
  });

  return {
    totalVisitors,
    visitorsWithMultipleSessions,
    multipleSessionsRate: percentOf(visitorsWithMultipleSessions, totalVisitors),
    visitorsReturnedOnLaterDay,
    returnedOnLaterDayRate: percentOf(visitorsReturnedOnLaterDay, totalVisitors)
  };
}

// Per-category rollup using the published catalogue's real handles/titles
// (never hardcoded). visitorToLessonRate is itself an ordered-progression
// measure: of the identities who viewed this category's page in range,
// what share went on to view one of ITS lessons at or after that view --
// not merely "also viewed a lesson in this category at some point".
export function computeCategoryPerformance(catalogue, eventsInRange) {
  eventsInRange = asArray(eventsInRange);
  const byIdentity = groupEventsByIdentity(eventsInRange);

  const lessonIdsByCategory = new Map();
  catalogue.lessons.forEach((lesson) => {
    if (!lessonIdsByCategory.has(lesson.category_handle)) lessonIdsByCategory.set(lesson.category_handle, new Set());
    lessonIdsByCategory.get(lesson.category_handle).add(lesson.lesson_id);
  });

  return catalogue.categories.map((category) => {
    const lessonIds = lessonIdsByCategory.get(category.handle) || new Set();

    const categoryViewEvents = eventsInRange.filter(
      (event) => event.event_type === "category_viewed" && event.metadata && event.metadata.category_handle === category.handle
    );
    const lessonViewEvents = eventsInRange.filter((event) => event.event_type === "lesson_viewed" && lessonIds.has(event.lesson_id));
    const quizEvents = eventsInRange.filter((event) => event.event_type === "quiz_completed" && lessonIds.has(event.lesson_id));

    const uniqueVisitors = new Set();
    categoryViewEvents.forEach((event) => {
      const identity = eventIdentity(event);
      if (identity) uniqueVisitors.add(identity);
    });

    const uniqueLessonViewers = new Set();
    lessonViewEvents.forEach((event) => {
      const identity = eventIdentity(event);
      if (identity) uniqueLessonViewers.add(identity);
    });

    const uniqueQuizCompleters = new Set();
    quizEvents.forEach((event) => {
      const identity = eventIdentity(event);
      if (identity) uniqueQuizCompleters.add(identity);
    });

    const quizPercentages = quizEvents
      .map((event) =>
        event.metadata && typeof event.metadata.score === "number" && typeof event.metadata.total === "number"
          ? percentOf(event.metadata.score, event.metadata.total)
          : null
      )
      .filter((value) => value !== null);
    const avgQuizPercent =
      quizPercentages.length > 0 ? Math.round(quizPercentages.reduce((sum, value) => sum + value, 0) / quizPercentages.length) : null;

    let progressedToLesson = 0;
    uniqueVisitors.forEach((identity) => {
      const identityEvents = byIdentity.get(identity) || [];
      const firstCategoryView = firstEventAtOrAfter(
        identityEvents,
        "category_viewed",
        null,
        (event) => event.metadata && event.metadata.category_handle === category.handle
      );
      if (!firstCategoryView) return;
      const hasLessonAfter = identityEvents.some(
        (event) => event.event_type === "lesson_viewed" && lessonIds.has(event.lesson_id) && toMs(event.created_at) >= firstCategoryView.ms
      );
      if (hasLessonAfter) progressedToLesson += 1;
    });

    return {
      handle: category.handle,
      title: category.title,
      lessonCount: lessonIds.size,
      uniqueVisitors: uniqueVisitors.size,
      categoryPageViews: categoryViewEvents.length,
      uniqueLessonViewers: uniqueLessonViewers.size,
      distinctLessonsViewed: new Set(lessonViewEvents.map((event) => event.lesson_id)).size,
      lessonViewEvents: lessonViewEvents.length,
      knowledgeChecksCompleted: quizEvents.length,
      uniqueQuizCompleters: uniqueQuizCompleters.size,
      avgQuizPercent,
      progressedToLessonVisitors: progressedToLesson,
      visitorToLessonRate: percentOf(progressedToLesson, uniqueVisitors.size)
    };
  });
}
