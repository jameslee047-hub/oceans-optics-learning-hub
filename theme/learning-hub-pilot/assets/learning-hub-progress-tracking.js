/**
 * Learning Hub Phase B, Checkpoint 2 -- authenticated lesson view / quiz
 * result tracking.
 *
 * Purely additive: listens for events already dispatched by
 * learning-hub-progress-auth.js (oo:learning-progress-ready) and
 * learning-hub-knowledge-check.js (oo:knowledge-check-completed) and, ONLY
 * when a Learning Progress session is authenticated, POSTs to the existing
 * /api/lesson/viewed and /api/quiz/result endpoints. Anonymous visitors are
 * completely unaffected -- every code path here is gated on
 * OOLearningProgress.isAuthenticated(), and every request is fire-and-
 * forget: a failure here never touches the Knowledge Check UI or the
 * lesson page, and never prevents the visitor from seeing their quiz
 * result (learning-hub-knowledge-check.js already rendered the score
 * before this file's listener even runs).
 *
 * Never sends a shopify_customer_id or any other customer identifier --
 * the backend derives identity itself from the bearer token
 * (OOLearningProgress.getToken()). Only ever sends the internal lesson_id
 * (via learning-hub-lesson-id-map.js), never the public lesson handle.
 */
(function () {
  'use strict';

  var API_ORIGIN = 'https://oceans-optics-learning-progress.vercel.app';
  var lessonViewedSent = false;

  function getCurrentLessonHandle() {
    var article = document.querySelector('.learning-lesson[data-lesson-handle]');
    return article ? article.getAttribute('data-lesson-handle') : null;
  }

  function lessonIdForHandle(handle) {
    var map = window.OOLearningHubLessonIdMap || {};
    return (handle && map[handle]) || null;
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

  // learning-hub-progress-auth.js loads before this file and calls its own
  // bootstrap() synchronously, but that bootstrap does its session
  // check/exchange asynchronously (fetch-based) -- so this listener is
  // always attached well before oo:learning-progress-ready can fire.
  document.addEventListener('oo:learning-progress-ready', sendLessonViewedIfApplicable);
  document.addEventListener('oo:knowledge-check-completed', onKnowledgeCheckCompleted);
})();
