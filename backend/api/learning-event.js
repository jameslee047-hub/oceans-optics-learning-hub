// POST /api/learning-event -- consented page/quiz analytics.
// Authenticated identity always comes from the signed Learning Progress
// bearer token. Anonymous identity is a random first-party UUID created by
// the storefront only while Shopify permits analytics processing.
import { applyCors } from "../lib/cors.js";
import { requireSession } from "../lib/require-session.js";
import { getSupabaseClient, findOrCreateLearningUser } from "../lib/supabase.js";
import { validateQuizResult, validateAnswerReview } from "../lib/progress-service.js";
import {
  recordLearningEvent,
  recordPageViewEvent,
  isClientReportableEventType,
  isAnonymousClientReportableEventType,
  LEARNING_CATALOGUE
} from "../lib/analytics-service.js";
import { isBehavioralAnalyticsEnabled } from "../lib/analytics-policy.js";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LESSON_IDS = new Set(LEARNING_CATALOGUE.lessons.map((lesson) => lesson.lesson_id));

function hasOnlyKeys(body, allowedKeys) {
  return Object.keys(body).every((key) => allowedKeys.has(key));
}

function validateCategoryHandle(categoryHandle) {
  return (
    typeof categoryHandle === "string" &&
    LEARNING_CATALOGUE.categories.some((category) => category.handle === categoryHandle)
  );
}

export function createLearningEventHandler({
  getClient = getSupabaseClient,
  findLearningUser = findOrCreateLearningUser,
  recordEvent = recordLearningEvent,
  recordPageView = recordPageViewEvent,
  analyticsEnabled = isBehavioralAnalyticsEnabled
} = {}) {
  return async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const authorization = req.headers.authorization || "";
  const authenticated = authorization.length > 0;
  const session = authenticated ? requireSession(req, res) : null;
  if (authenticated && !session) return;

  const eventType = body.event_type;
  const isAllowedType = authenticated
    ? isClientReportableEventType(eventType)
    : isAnonymousClientReportableEventType(eventType);
  if (typeof eventType !== "string" || !isAllowedType) {
    res.status(400).json({ error: "invalid_event_type" });
    return;
  }

  const allowedKeys = new Set(["event_type"]);
  if (!authenticated) allowedKeys.add("anonymous_visitor_id");
  if (eventType === "category_viewed") allowedKeys.add("category_handle");
  if (eventType === "lesson_viewed" || eventType === "quiz_completed") allowedKeys.add("lesson_id");
  if (eventType === "quiz_completed") {
    allowedKeys.add("score");
    allowedKeys.add("total");
    allowedKeys.add("answers");
  }
  if (!hasOnlyKeys(body, allowedKeys)) {
    res.status(400).json({ error: "invalid_event_payload" });
    return;
  }

  const anonymousVisitorId = authenticated ? null : body.anonymous_visitor_id;
  if (!authenticated && (typeof anonymousVisitorId !== "string" || !UUID_V4_PATTERN.test(anonymousVisitorId))) {
    res.status(400).json({ error: "invalid_anonymous_visitor_id" });
    return;
  }

  let lessonId = null;
  let metadata = null;
  if (eventType === "category_viewed") {
    if (!validateCategoryHandle(body.category_handle)) {
      res.status(400).json({ error: "invalid_category_handle" });
      return;
    }
    metadata = { category_handle: body.category_handle };
  }
  if (eventType === "lesson_viewed" || eventType === "quiz_completed") {
    lessonId = body.lesson_id;
    if (typeof lessonId !== "string" || !LESSON_IDS.has(lessonId)) {
      res.status(400).json({ error: "invalid_lesson_id" });
      return;
    }
  }
  if (eventType === "quiz_completed") {
    const quizValidation = validateQuizResult({ score: body.score, total: body.total });
    if (!quizValidation.valid) {
      res.status(400).json({ error: quizValidation.reason });
      return;
    }
    const answerValidation = validateAnswerReview(body.answers);
    if (!answerValidation.valid) {
      res.status(400).json({ error: answerValidation.reason });
      return;
    }
    metadata = { score: body.score, total: body.total, answers: answerValidation.answers };
  }

  // Every request-shape/content validation above still runs unconditionally
  // (a Preview/dev tester's own bad request still gets a real 400) -- only
  // the actual database work is skipped here, so behavioural analytics
  // writes happen ONLY on confirmed Vercel Production traffic. This never
  // touches authenticated session validity or progress state; it only
  // means this specific event is not recorded.
  if (!analyticsEnabled()) {
    res.status(200).json({ recorded: false, reason: "analytics_disabled" });
    return;
  }

  try {
    const supabase = await getClient();
    let learningUserId = null;
    if (authenticated) {
      learningUserId = await findLearningUser(supabase, session.shopify_customer_id);
    }

    const eventParams = { learningUserId, anonymousVisitorId, eventType, lessonId, metadata };
    if (eventType === "quiz_completed") {
      await recordEvent(supabase, eventParams);
    } else {
      await recordPageView(supabase, eventParams);
    }
    res.status(200).json({ recorded: true });
  } catch (error) {
    console.error("POST /api/learning-event failed", error);
    res.status(500).json({ error: "record_event_failed" });
  }
}
}

export default createLearningEventHandler();
