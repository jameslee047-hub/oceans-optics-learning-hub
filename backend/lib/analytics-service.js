// Core analytics aggregation for the internal admin dashboard
// (api/admin/*). Kept separate from route handlers so it can be unit
// tested against plain fixture arrays -- no real Supabase connection.
//
// learning_events (migrations/0004_learning_events.sql) is history/
// analytics only. lesson_progress and knowledge_check_results remain the
// source of truth for current state -- every function here that reports
// "is this lesson complete" or "what was the score" reads those tables,
// never learning_events.
//
// Every function defends against missing/malformed input (null, wrong
// shape) by normalizing to empty arrays/zero results rather than
// throwing, matching the same defensive convention as
// theme/learning-hub-pilot/assets/learning-hub-my-learning-core.js.
import { LEARNING_CATALOGUE } from "./lesson-catalogue.js";

export const KNOWN_EVENT_TYPES = [
  "learning_hub_viewed",
  "category_viewed",
  "lesson_viewed",
  "lesson_completed",
  "quiz_completed",
  "progress_dashboard_viewed"
];
const KNOWN_EVENT_TYPE_SET = new Set(KNOWN_EVENT_TYPES);

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
export async function recordLearningEvent(supabase, { learningUserId = null, eventType, lessonId = null, metadata = null }) {
  if (!KNOWN_EVENT_TYPE_SET.has(eventType)) {
    throw new Error(`unknown_event_type:${eventType}`);
  }

  const { error } = await supabase.from("learning_events").insert({
    learning_user_id: learningUserId,
    event_type: eventType,
    lesson_id: lessonId,
    metadata: metadata
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

// Summary metrics for the selected date range.
//
// - totalLearners: ALWAYS all-time (a running total of registered
//   learners), regardless of the selected range.
// - activeLearners: distinct learners with a lesson view, lesson
//   completion, or quiz completion whose timestamp falls in the range --
//   derived from lesson_progress/knowledge_check_results (the source of
//   truth), not learning_events, so this works even for periods before
//   event logging existed.
// - lessonStarts/lessonCompletions/completionRate: completionRate is
//   completions-in-range / starts-in-range, i.e. "of the lessons started
//   in this period, what fraction were also completed" -- not a ratio
//   against the whole catalogue.
// - returningLearners: null (not just 0) when learning_events has no
//   rows at all, or the range is "all time" -- there is no meaningful
//   "were they active before this period" signal in either case, and a
//   metric must not be shown as if it were a real zero.
export function computeSummaryMetrics({ users, lessonProgress, quizResults, events }, dateRange) {
  users = asArray(users);
  lessonProgress = asArray(lessonProgress);
  quizResults = asArray(quizResults);
  events = asArray(events);

  const totalLearners = users.length;

  const startsInRange = lessonProgress.filter((row) => isWithinRange(row.first_viewed_at, dateRange));
  const completionsInRange = lessonProgress.filter((row) => isWithinRange(row.completed_at, dateRange));
  const quizzesInRange = quizResults.filter((row) => isWithinRange(row.completed_at, dateRange));

  const activeLearnerIds = new Set();
  startsInRange.forEach((row) => activeLearnerIds.add(row.user_id));
  completionsInRange.forEach((row) => activeLearnerIds.add(row.user_id));
  quizzesInRange.forEach((row) => activeLearnerIds.add(row.user_id));

  const lessonStarts = startsInRange.length;
  const lessonCompletions = completionsInRange.length;
  const completionRate = lessonStarts > 0 ? percentOf(lessonCompletions, lessonStarts) : 0;

  const quizzesCompleted = quizzesInRange.length;
  const avgQuizPercent =
    quizzesCompleted > 0
      ? Math.round(quizzesInRange.reduce((sum, row) => sum + percentOf(row.score, row.total), 0) / quizzesCompleted)
      : null;

  let returningLearners = null;
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
  }

  return {
    range: dateRange.range,
    totalLearners,
    activeLearners: activeLearnerIds.size,
    lessonStarts,
    lessonCompletions,
    completionRate,
    quizzesCompleted,
    avgQuizPercent,
    returningLearners
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

// One row per published lesson -- traffic, completion, quiz performance,
// and (when answer snapshots exist) the single most-missed question.
export function computeLessonPerformance(catalogue, lessonProgress, quizResults) {
  lessonProgress = asArray(lessonProgress);
  quizResults = asArray(quizResults);
  const categoryTitleByHandle = {};
  catalogue.categories.forEach((category) => {
    categoryTitleByHandle[category.handle] = category.title;
  });

  return catalogue.lessons.map((lesson) => {
    // lesson_progress's primary key is (user_id, lesson_id), so each user
    // contributes at most one row per lesson -- row count IS unique
    // viewers, no separate de-duplication needed.
    const progressRows = lessonProgress.filter((row) => row.lesson_id === lesson.lesson_id);
    const quizRows = quizResults.filter((row) => row.lesson_id === lesson.lesson_id);

    const uniqueViewers = progressRows.length;
    const completions = progressRows.filter((row) => row.completed_at).length;
    const completionRate = percentOf(completions, uniqueViewers);

    const quizCount = quizRows.length;
    const avgQuizPercent =
      quizCount > 0 ? Math.round(quizRows.reduce((sum, row) => sum + percentOf(row.score, row.total), 0) / quizCount) : null;

    return {
      lesson_id: lesson.lesson_id,
      handle: lesson.handle,
      title: lesson.title,
      category_handle: lesson.category_handle,
      category_title: categoryTitleByHandle[lesson.category_handle] || "",
      uniqueViewers,
      completions,
      completionRate,
      quizCount,
      avgQuizPercent,
      mostMissedQuestion: computeMostMissedQuestion(quizRows)
    };
  });
}

// Per-lesson, per-question stats from stored answer snapshots only. Rows
// whose lesson_id isn't in the published catalogue, or that have no
// `answers` snapshot at all (legacy pre-migration rows, or a submission
// that omitted it), are skipped entirely -- never counted toward sample
// size or percentages.
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
    if (!Array.isArray(row.answers)) return;
    const lesson = lessonById[row.lesson_id];
    if (!lesson) return;

    if (!byLessonThenQuestion[row.lesson_id]) byLessonThenQuestion[row.lesson_id] = {};
    const questionsForLesson = byLessonThenQuestion[row.lesson_id];

    row.answers.forEach((item) => {
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

// One row per registered learner. completion_percent is against the whole
// published catalogue (matching the customer-facing My Learning Progress
// dashboard's own definition), not against only the lessons they've
// started.
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
      lessons_viewed: progressRows.length,
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
