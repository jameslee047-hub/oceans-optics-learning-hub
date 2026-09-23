/**
 * Learning Hub Phase B -- authenticated lesson view / quiz result / page
 * view tracking.
 *
 * Loaded on all four Learning Hub page types (homepage, category, lesson,
 * My Learning Progress). Purely additive: listens for events already
 * dispatched by learning-hub-progress-auth.js (oo:learning-progress-ready)
 * and learning-hub-knowledge-check.js (oo:knowledge-check-completed) and,
 * ONLY when a Learning Progress session is authenticated, POSTs to the
 * existing /api/lesson/viewed and /api/quiz/result endpoints, plus the
 * shared /api/learning-event endpoint for page-view-style analytics
 * (learning_hub_viewed, category_viewed, progress_dashboard_viewed --
 * lesson_viewed goes through /api/lesson/viewed instead, since that
 * endpoint already records it as part of verifying the lesson exists).
 *
 * Anonymous visitors are completely unaffected -- every code path here is
 * gated on OOLearningProgress.isAuthenticated(), and no identity is
 * invented for one (no cookie, no fingerprint, added solely to track an
 * anonymous visitor). Every request is fire-and-forget: a failure here
 * never touches the Knowledge Check UI or the current page, and never
 * prevents the visitor from seeing their quiz result
 * (learning-hub-knowledge-check.js already rendered the score before this
 * file's listener even runs).
 *
 * Never sends a shopify_customer_id or any other customer identifier --
 * the backend derives identity itself from the bearer token
 * (OOLearningProgress.getToken()). Only ever sends the internal lesson_id
 * (via learning-hub-lesson-id-map.js) or a category's own public handle
 * (already visible in that page's own URL), never anything else about the
 * visitor.
 */
(function () {
  'use strict';

  var API_ORIGIN = 'https://oceans-optics-learning-progress.vercel.app';
  var lessonViewedSent = false;
  var pageViewEventSent = false;

  function getCurrentLessonHandle() {
    var article = document.querySelector('.learning-lesson[data-lesson-handle]');
    return article ? article.getAttribute('data-lesson-handle') : null;
  }

  function lessonIdForHandle(handle) {
    var map = window.OOLearningHubLessonIdMap || {};
    return (handle && map[handle]) || null;
  }

  // Pure: derives which page-view event (if any) applies from the URL
  // alone -- no DOM markers needed on any of the four page templates,
  // since each already has a distinct, stable path
  // (/pages/learn, /pages/learn-category/<handle>, /pages/my-learning).
  // Lesson pages (/pages/learn/<handle>) intentionally return null here --
  // their view is tracked via sendLessonViewedIfApplicable() below
  // instead, through /api/lesson/viewed.
  function detectPageViewContext(pathname) {
    var path = String(pathname || '').replace(/\/+$/, '');
    if (path === '/pages/learn') return { eventType: 'learning_hub_viewed' };

    var categoryMatch = path.match(/^\/pages\/learn-category\/([^/]+)$/);
    if (categoryMatch) return { eventType: 'category_viewed', categoryHandle: categoryMatch[1] };

    if (path === '/pages/my-learning') return { eventType: 'progress_dashboard_viewed' };

    return null;
  }

  function isAuthenticated() {
    return !!(window.OOLearningProgress && window.OOLearningProgress.isAuthenticated());
  }

  function authorizedFetch(path, body) {
    var token = window.OOLearningProgress && window.OOLearningProgress.getToken();
    if (!token) return;

    // Fire-and-forget: no caller waits on this, no UI depends on its
    // outcome, and any failure (network, 401, 500, etc.) is swallowed here
    // rather than surfaced anywhere a visitor would notice.
    fetch(API_ORIGIN + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(body)
    }).catch(function () {
      // Best-effort only -- see file header.
    });
  }

  function sendLessonViewedIfApplicable() {
    if (lessonViewedSent) return;
    if (!isAuthenticated()) return;

    var lessonId = lessonIdForHandle(getCurrentLessonHandle());
    if (!lessonId) return;

    lessonViewedSent = true;
    authorizedFetch('/api/lesson/viewed', { lesson_id: lessonId });
  }

  function sendPageViewEventIfApplicable() {
    if (pageViewEventSent) return;
    if (!isAuthenticated()) return;

    var context = detectPageViewContext(window.location.pathname);
    if (!context) return;

    pageViewEventSent = true;
    var body = { event_type: context.eventType };
    if (context.categoryHandle) body.category_handle = context.categoryHandle;
    authorizedFetch('/api/learning-event', body);
  }

  function onKnowledgeCheckCompleted(event) {
    if (!isAuthenticated()) return;

    var detail = event.detail || {};
    var lessonId = lessonIdForHandle(detail.lessonHandle);
    if (!lessonId) return;
    if (!Number.isInteger(detail.score) || !Number.isInteger(detail.total)) return;

    var body = {
      lesson_id: lessonId,
      score: detail.score,
      total: detail.total
    };

    // Optional answer-review snapshot (see learning-hub-knowledge-check.js
    // and lib/progress-service.js's validateAnswerReview on the backend,
    // which is the actual source of truth for what shape is accepted --
    // this is only a cheap pre-check so an obviously-wrong payload isn't
    // sent at all; omitting it entirely is always backward compatible).
    if (Array.isArray(detail.answers) && detail.answers.length > 0) {
      body.answers = detail.answers;
    }

    authorizedFetch('/api/quiz/result', body);
  }

  function onLearningProgressReady() {
    sendLessonViewedIfApplicable();
    sendPageViewEventIfApplicable();
  }

  // learning-hub-progress-auth.js loads before this file and calls its own
  // bootstrap() synchronously. For an AUTHENTICATED visitor that bootstrap
  // always finishes asynchronously (a real fetch, either exchanging a
  // handoff or re-validating a stored token), so this listener is always
  // attached in time to catch oo:learning-progress-ready. For an
  // ANONYMOUS visitor bootstrap can finish (and dispatch that event)
  // synchronously before this file even runs -- but every function above
  // is gated on isAuthenticated() anyway, so a missed event there is
  // still correctly a no-op, not a bug (unlike a UI that needs to render
  // something for the anonymous case too, e.g. learning-hub-my-learning.js).
  document.addEventListener('oo:learning-progress-ready', onLearningProgressReady);
  document.addEventListener('oo:knowledge-check-completed', onKnowledgeCheckCompleted);
})();
