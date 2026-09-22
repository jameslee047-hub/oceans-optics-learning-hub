/**
 * Learning Hub Phase B, Checkpoint 3 (redesigned) -- "My Learning"
 * dashboard DOM wiring.
 *
 * Depends on (all loaded before this file by learning-my-learning.liquid):
 *   - window.OOLearningProgress          (learning-hub-progress-auth.js)
 *   - window.OOLearningHubCatalogueData  (learning-hub-catalogue-data.js)
 *   - window.OOLearningHubMyLearningCore (learning-hub-my-learning-core.js)
 *
 * This file only renders HTML from data it is handed -- every actual
 * completion/score number comes from GET /api/progress via
 * OOLearningProgress.fetchProgress() and the published catalogue; nothing
 * here invents progress. All calculation logic lives in, and is unit
 * tested via, learning-hub-my-learning-core.js.
 *
 * States: loading -> logged-out | error | dashboard. An expired/invalid
 * session (fetchProgress() returning expired:true, which
 * learning-hub-progress-auth.js has already cleared from sessionStorage)
 * falls back to the logged-out state, not an error. Any other failure
 * (network, 5xx) shows a retry option and never throws past this file.
 *
 * INITIALIZATION: OOLearningProgress.isReady() may already be true by the
 * time this script runs (an anonymous visitor's bootstrap dispatches
 * oo:learning-progress-ready SYNCHRONOUSLY, before this later <script
 * defer> tag even starts executing -- see the isReady comment in
 * learning-hub-progress-auth.js). So this checks isReady() immediately
 * AND listens for the event; whichever happens/happened first wins, and
 * an `initialized` guard makes the other one a no-op.
 */
(function () {
  'use strict';

  var STATE_IDS = ['MyLearningLoading', 'MyLearningLoggedOut', 'MyLearningError', 'MyLearningDashboard'];
  var RECENT_ACTIVITY_LIMIT = 5;

  function showState(idToShow) {
    STATE_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = id !== idToShow;
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function lessonUrl(handle) {
    return '/pages/learn/' + handle;
  }

  function categoryUrl(handle) {
    return '/pages/learn-category/' + handle;
  }

  function formatDate(atMs) {
    try {
      return new Date(atMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (error) {
      return '';
    }
  }

  function progressBarHtml(percent, modifierClass) {
    var clamped = Math.max(0, Math.min(100, percent));
    return (
      '<div class="learning-progress-bar' +
      (modifierClass ? ' ' + modifierClass : '') +
      '" role="progressbar" aria-valuenow="' +
      clamped +
      '" aria-valuemin="0" aria-valuemax="100">' +
      '<div class="learning-progress-bar__fill" style="width:' +
      clamped +
      '%"></div>' +
      '</div>'
    );
  }

  // The single most important element on the page: overall completion on
  // the left, the one next action on the right. Both halves of one
  // visually dominant panel, not two separate cards of equal weight.
  function renderHero(overall, continueLearning) {
    var progressHtml = [
      '<div class="learning-my-learning__hero-progress">',
      '<p class="learning-my-learning__hero-eyebrow">Overall Progress</p>',
      '<div class="learning-my-learning__hero-percent">' + overall.percent + '%</div>',
      '<p class="learning-my-learning__hero-count">' +
        overall.completedCount +
        ' of ' +
        overall.totalCount +
        ' lessons completed</p>',
      progressBarHtml(overall.percent, 'learning-progress-bar--thick'),
      '</div>'
    ].join('');

    var nextHtml;
    if (!continueLearning) {
      nextHtml = [
        '<div class="learning-my-learning__hero-next learning-my-learning__hero-next--done">',
        '<p class="learning-my-learning__hero-next-label">All caught up</p>',
        '<h2>You&rsquo;ve completed every published lesson</h2>',
        '<p>Nice work! Check back as new lessons are published.</p>',
        '</div>'
      ].join('');
    } else {
      var isResume = continueLearning.reason === 'resume';
      var label = isResume ? 'Continue learning' : 'Up next';
      var actionLabel = isResume ? 'Continue lesson' : 'Start lesson';
      nextHtml = [
        '<div class="learning-my-learning__hero-next">',
        '<p class="learning-my-learning__hero-next-label">' + label + '</p>',
        '<span class="learning-card__meta">' + escapeHtml(continueLearning.category_title) + '</span>',
        '<h2>' + escapeHtml(continueLearning.title) + '</h2>',
        '<a class="button learning-cta" href="' + lessonUrl(continueLearning.handle) + '">' + actionLabel + '</a>',
        '</div>'
      ].join('');
    }

    return '<div class="learning-panel learning-my-learning__hero">' + progressHtml + nextHtml + '</div>';
  }

  function renderCategories(categories) {
    if (!categories.length) return '';
    var Core = window.OOLearningHubMyLearningCore;
    var cards = categories
      .map(function (category) {
        var actionLabel = Core.categoryActionLabel(category.percent);
        return [
          '<a class="learning-card learning-my-learning__category-card" href="' + categoryUrl(category.handle) + '">',
          '<h3>' + escapeHtml(category.title) + '</h3>',
          '<p>' + category.completed + ' of ' + category.total + ' lessons &middot; ' + category.percent + '%</p>',
          progressBarHtml(category.percent),
          '<span class="learning-card__footer">' + actionLabel + ' &rarr;</span>',
          '</a>'
        ].join('');
      })
      .join('');

    return [
      '<div class="learning-my-learning__section">',
      '<h2 class="learning-my-learning__section-title">Learning areas</h2>',
      '<div class="learning-grid">' + cards + '</div>',
      '</div>'
    ].join('');
  }

  function renderQuizzes(quizzes) {
    var body;
    if (!quizzes.length) {
      body = '<p class="learning-empty">Complete a Knowledge Check on a lesson page to see your results here.</p>';
    } else {
      body =
        '<ul class="learning-my-learning__quiz-list">' +
        quizzes
          .map(function (quiz) {
            return [
              '<li class="learning-my-learning__quiz-row">',
              '<a href="' + lessonUrl(quiz.handle) + '">' + escapeHtml(quiz.title) + '</a>',
              '<span>' + quiz.score + '/' + quiz.total + ' &middot; ' + quiz.percent + '%</span>',
              '</li>'
            ].join('');
          })
          .join('') +
        '</ul>';
    }

    return ['<div class="learning-my-learning__panel">', '<h2 class="learning-my-learning__section-title">Knowledge checks</h2>', body, '</div>'].join('');
  }

  function activityLabel(event) {
    if (event.type === 'quiz') return 'Scored ' + event.score + '/' + event.total;
    if (event.type === 'completed') return 'Completed';
    return 'Viewed';
  }

  function renderRecentActivity(recentActivity) {
    var body;
    if (!recentActivity.length) {
      body = '<p class="learning-empty">Your recent lesson views and completions will show up here.</p>';
    } else {
      body =
        '<ul class="learning-my-learning__activity-list">' +
        recentActivity
          .map(function (event) {
            return [
              '<li class="learning-my-learning__activity-row">',
              '<span class="learning-my-learning__activity-label">' + activityLabel(event) + '</span>',
              '<a href="' + lessonUrl(event.lesson_id) + '">' + escapeHtml(event.title || event.lesson_id) + '</a>',
              '<span class="learning-my-learning__activity-date">' + formatDate(event.at) + '</span>',
              '</li>'
            ].join('');
          })
          .join('') +
        '</ul>';
    }

    return ['<div class="learning-my-learning__panel">', '<h2 class="learning-my-learning__section-title">Recent learning</h2>', body, '</div>'].join('');
  }

  function renderDashboard(viewModel) {
    var root = document.getElementById('MyLearningDashboard');
    if (!root) return;

    root.innerHTML = [
      renderHero(viewModel.overall, viewModel.continueLearning),
      renderCategories(viewModel.categories),
      '<div class="learning-my-learning__lower-grid">',
      renderQuizzes(viewModel.quizzes),
      renderRecentActivity(viewModel.recentActivity.slice(0, RECENT_ACTIVITY_LIMIT)),
      '</div>'
    ].join('');

    showState('MyLearningDashboard');
  }

  function wireStaticButtons() {
    var authenticateButtons = document.querySelectorAll('[data-my-learning-authenticate]');
    Array.prototype.forEach.call(authenticateButtons, function (button) {
      button.addEventListener('click', function () {
        if (window.OOLearningProgress) window.OOLearningProgress.authenticate();
      });
    });

    var retryButtons = document.querySelectorAll('[data-my-learning-retry]');
    Array.prototype.forEach.call(retryButtons, function (button) {
      button.addEventListener('click', loadDashboard);
    });
  }

  function loadDashboard() {
    showState('MyLearningLoading');

    if (!window.OOLearningProgress || !window.OOLearningProgress.isAuthenticated()) {
      showState('MyLearningLoggedOut');
      return;
    }

    window.OOLearningProgress.fetchProgress().then(function (result) {
      if (!result.ok && result.expired) {
        // Session was cleared by OOLearningProgress itself -- fall back to
        // the logged-out state, not an error.
        showState('MyLearningLoggedOut');
        return;
      }
      if (!result.ok) {
        showState('MyLearningError');
        return;
      }

      var Core = window.OOLearningHubMyLearningCore;
      var catalogue = window.OOLearningHubCatalogueData;
      if (!Core || !catalogue) {
        showState('MyLearningError');
        return;
      }

      var viewModel = Core.buildDashboardViewModel(catalogue, result.data);
      renderDashboard(viewModel);
    });
  }

  // Coordinates the two ways bootstrap can already have finished (see file
  // header): calling this more than once is safe -- only the first call
  // actually loads the dashboard.
  function createInitializer() {
    var initialized = false;
    return function initOnce() {
      if (initialized) return;
      initialized = true;
      loadDashboard();
    };
  }

  function init() {
    wireStaticButtons();

    var progressApi = window.OOLearningProgress;
    var initOnce = createInitializer();

    if (progressApi && typeof progressApi.isReady === 'function' && progressApi.isReady()) {
      initOnce();
    } else {
      document.addEventListener('oo:learning-progress-ready', initOnce);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
