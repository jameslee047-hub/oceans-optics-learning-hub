/**
 * Learning Hub activity tracking for authenticated learners and consented
 * anonymous visitors. Anonymous identity is a random first-party UUID in
 * localStorage; it is never derived from customer, network, browser, or
 * device data and is removed whenever analytics processing is denied.
 */
(function () {
  'use strict';

  var API_ORIGIN = 'https://oceans-optics-learning-progress.vercel.app';
  var ANONYMOUS_STORAGE_KEY = 'oo_learning_analytics_visitor_v1';
  var UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var lessonViewedSent = false;
  var pageViewEventSent = false;
  var privacyLoadStarted = false;
  var privacyCallbacks = [];

  function getCurrentLessonHandle() {
    var article = document.querySelector('.learning-lesson[data-lesson-handle]');
    return article ? article.getAttribute('data-lesson-handle') : null;
  }

  function lessonIdForHandle(handle) {
    var map = window.OOLearningHubLessonIdMap || {};
    return (handle && map[handle]) || null;
  }

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

  function postJson(path, body, token) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    fetch(API_ORIGIN + path, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    }).catch(function () {
      // Analytics and progress writes remain best-effort from the UI.
    });
  }

  function authorizedFetch(path, body) {
    var token = window.OOLearningProgress && window.OOLearningProgress.getToken();
    if (token) postJson(path, body, token);
  }

  function finishPrivacyLoad(api) {
    var callbacks = privacyCallbacks.slice();
    privacyCallbacks = [];
    callbacks.forEach(function (callback) { callback(api); });
  }

  function withCustomerPrivacy(callback) {
    var shopify = window.Shopify;
    if (shopify && shopify.customerPrivacy) {
      callback(shopify.customerPrivacy);
      return;
    }
    privacyCallbacks.push(callback);
    if (privacyLoadStarted) return;
    privacyLoadStarted = true;
    if (!shopify || typeof shopify.loadFeatures !== 'function') {
      finishPrivacyLoad(null);
      return;
    }
    shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.1' }], function (error) {
      finishPrivacyLoad(error || !shopify.customerPrivacy ? null : shopify.customerPrivacy);
    });
  }

  function clearAnonymousVisitorId() {
    try {
      window.localStorage.removeItem(ANONYMOUS_STORAGE_KEY);
    } catch (error) {
      // Storage can be unavailable; absence is already the privacy-safe state.
    }
  }

  function createUuid() {
    var cryptoApi = window.crypto;
    if (!cryptoApi) return null;
    if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
    if (typeof cryptoApi.getRandomValues !== 'function') return null;
    var bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    return Array.prototype.map.call(bytes, function (byte, index) {
      return (index === 4 || index === 6 || index === 8 || index === 10 ? '-' : '') + byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function withAnonymousVisitor(callback) {
    withCustomerPrivacy(function (privacy) {
      if (!privacy || typeof privacy.analyticsProcessingAllowed !== 'function' || privacy.analyticsProcessingAllowed() !== true) {
        clearAnonymousVisitorId();
        return;
      }
      var visitorId = null;
      try {
        visitorId = window.localStorage.getItem(ANONYMOUS_STORAGE_KEY);
        if (visitorId && !UUID_V4_PATTERN.test(visitorId)) {
          window.localStorage.removeItem(ANONYMOUS_STORAGE_KEY);
          visitorId = null;
        }
        if (!visitorId) {
          visitorId = createUuid();
          if (!visitorId) return;
          window.localStorage.setItem(ANONYMOUS_STORAGE_KEY, visitorId);
        }
      } catch (error) {
        return;
      }
      callback(visitorId);
    });
  }

  function anonymousFetch(body) {
    withAnonymousVisitor(function (visitorId) {
      body.anonymous_visitor_id = visitorId;
      postJson('/api/learning-event', body, null);
    });
  }

  function sendLessonViewedIfApplicable() {
    if (lessonViewedSent) return;
    var lessonId = lessonIdForHandle(getCurrentLessonHandle());
    if (!lessonId) return;

    if (isAuthenticated()) {
      lessonViewedSent = true;
      authorizedFetch('/api/lesson/viewed', { lesson_id: lessonId });
      return;
    }
    withAnonymousVisitor(function (visitorId) {
      if (lessonViewedSent || isAuthenticated()) return;
      lessonViewedSent = true;
      postJson('/api/learning-event', {
        event_type: 'lesson_viewed',
        lesson_id: lessonId,
        anonymous_visitor_id: visitorId
      }, null);
    });
  }

  function sendPageViewEventIfApplicable() {
    if (pageViewEventSent) return;
    var context = detectPageViewContext(window.location.pathname);
    if (!context) return;

    var body = { event_type: context.eventType };
    if (context.categoryHandle) body.category_handle = context.categoryHandle;
    if (isAuthenticated()) {
      pageViewEventSent = true;
      authorizedFetch('/api/learning-event', body);
      return;
    }
    if (context.eventType === 'progress_dashboard_viewed') return;
    withAnonymousVisitor(function (visitorId) {
      if (pageViewEventSent || isAuthenticated()) return;
      pageViewEventSent = true;
      body.anonymous_visitor_id = visitorId;
      postJson('/api/learning-event', body, null);
    });
  }

  function onKnowledgeCheckCompleted(event) {
    var detail = event.detail || {};
    var lessonId = lessonIdForHandle(detail.lessonHandle);
    if (!lessonId || !Number.isInteger(detail.score) || !Number.isInteger(detail.total)) return;

    var body = { lesson_id: lessonId, score: detail.score, total: detail.total };
    if (Array.isArray(detail.answers) && detail.answers.length > 0) body.answers = detail.answers;

    if (isAuthenticated()) {
      authorizedFetch('/api/quiz/result', body);
      return;
    }
    body.event_type = 'quiz_completed';
    anonymousFetch(body);
  }

  function onLearningProgressReady() {
    sendLessonViewedIfApplicable();
    sendPageViewEventIfApplicable();
  }

  document.addEventListener('visitorConsentCollected', function (event) {
    if (!event.detail || event.detail.analyticsAllowed !== true) {
      clearAnonymousVisitorId();
      return;
    }
    if (!isAuthenticated()) onLearningProgressReady();
  });
  document.addEventListener('oo:learning-progress-ready', onLearningProgressReady);
  document.addEventListener('oo:knowledge-check-completed', onKnowledgeCheckCompleted);

  if (window.OOLearningProgress && typeof window.OOLearningProgress.isReady === 'function' && window.OOLearningProgress.isReady()) {
    onLearningProgressReady();
  }
})();
