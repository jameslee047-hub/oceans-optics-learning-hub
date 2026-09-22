/**
 * Learning Hub Phase B, Checkpoint 3 -- "My Learning" dashboard DOM wiring.
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
 */
(function () {
  'use strict';

  var STATE_IDS = ['MyLearningLoading', 'MyLearningLoggedOut', 'MyLearningError', 'MyLearningDashboard'];

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
      return new Date(atMs).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (error) {
      return '';
    }
  }

  function progressBarHtml(percent) {
    var clamped = Math.max(0, Math.min(100, percent));
    return (
      '<div class="learning-progress-bar" role="progressbar" aria-valuenow="' +
      clamped +
      '" aria-valuemin="0" aria-valuemax="100">' +
      '<div class="learning-progress-bar__fill" style="width:' +
      clamped +
      '%"></div>' +
      '</div>'
    );
  }

  function renderOverall(overall) {
    return [
      '<div class="learning-panel learning-my-learning__overall">',
      '<p class="learning-hub__eyebrow">Overall Progress</p>',
      '<div class="learning-my-learning__overall-row">',
      '<span class="learning-my-learning__percent">' + overall.percent + '%</span>',
      '<span class="learning-my-learning__count">' +
        overall.completedCount +
        ' of ' +
        overall.totalCount +
        ' lessons completed</span>',
      '</div>',
      progressBarHtml(overall.percent),
      '</div>'
    ].join('');
  }

  function renderContinueLearning(continueLearning) {
    if (!continueLearning) {
      return [
        '<div class="learning-panel learning-my-learning__continue">',
        '<p class="learning-hub__eyebrow">Continue Learning</p>',
        '<h2>You&rsquo;ve completed every published lesson</h2>',
        '<p>Nice work! Check back as new lessons are published.</p>',
        '</div>'
      ].join('');
    }

    var actionLabel = continueLearning.reason === 'resume' ? 'Continue lesson' : 'Start lesson';
    return [
      '<div class="learning-panel learning-my-learning__continue">',
      '<p class="learning-hub__eyebrow">Continue Learning</p>',
      '<span class="learning-card__meta">' + escapeHtml(continueLearning.category_title) + '</span>',
      '<h2>' + escapeHtml(continueLearning.title) + '</h2>',
      '<a class="button learning-cta" href="' + lessonUrl(continueLearning.handle) + '">' + actionLabel + '</a>',
      '</div>'
    ].join('');
  }

  function renderCategories(categories) {
    if (!categories.length) return '';
    var cards = categories
      .map(function (category) {
        return [
          '<a class="learning-card learning-my-learning__category-card" href="' + categoryUrl(category.handle) + '">',
          '<h3>' + escapeHtml(category.title) + '</h3>',
          '<p>' + category.completed + ' of ' + category.total + ' lessons (' + category.percent + '%)</p>',
          progressBarHtml(category.percent),
          '<span class="learning-card__footer">View category</span>',
          '</a>'
        ].join('');
      })
      .join('');

    return [
      '<div class="learning-my-learning__section">',
      '<div class="learning-hub__section-heading"><div><p class="learning-hub__eyebrow">Category Progress</p><h2>By category</h2></div></div>',
      '<div class="learning-grid">' + cards + '</div>',
      '</div>'
    ].join('');
  }

  function renderLessonRow(lesson, statusLabel) {
    return [
      '<li class="learning-my-learning__lesson-row">',
      '<a href="' + lessonUrl(lesson.handle) + '">' + escapeHtml(lesson.title) + '</a>',
      '<span class="learning-my-learning__lesson-status learning-my-learning__lesson-status--' + statusLabel.toLowerCase().replace(/\s+/g, '-') + '">' +
        escapeHtml(statusLabel) +
        '</span>',
      '</li>'
    ].join('');
  }

  function renderLessons(lessons) {
    var completedRows = lessons.completed.map(function (lesson) {
      return renderLessonRow(lesson, 'Completed');
    });
    var inProgressRows = lessons.inProgress.map(function (lesson) {
      return renderLessonRow(lesson, 'In progress');
    });

    var listsHtml = '';
    if (completedRows.length) {
      listsHtml += '<div><h3>Completed (' + completedRows.length + ')</h3><ul class="learning-my-learning__lesson-list">' + completedRows.join('') + '</ul></div>';
    }
    if (inProgressRows.length) {
      listsHtml += '<div><h3>In progress (' + inProgressRows.length + ')</h3><ul class="learning-my-learning__lesson-list">' + inProgressRows.join('') + '</ul></div>';
    }
    if (!completedRows.length && !inProgressRows.length) {
      listsHtml = '<p class="learning-empty">You haven&rsquo;t started a lesson yet.</p>';
    }

    var notStartedNote = lessons.notStarted.length
      ? '<p class="learning-my-learning__not-started-note">' + lessons.notStarted.length + ' lesson' + (lessons.notStarted.length === 1 ? '' : 's') + ' not started yet.</p>'
      : '';

    return [
      '<div class="learning-my-learning__section">',
      '<div class="learning-hub__section-heading"><div><p class="learning-hub__eyebrow">Lesson Progress</p><h2>Your lessons</h2></div></div>',
      '<div class="learning-my-learning__lesson-lists">' + listsHtml + '</div>',
      notStartedNote,
      '</div>'
    ].join('');
  }

  function renderQuizzes(quizzes) {
    if (!quizzes.length) {
      return [
        '<div class="learning-my-learning__section">',
        '<div class="learning-hub__section-heading"><div><p class="learning-hub__eyebrow">Knowledge Check Results</p><h2>Your quiz results</h2></div></div>',
        '<p class="learning-empty">Complete a Knowledge Check on a lesson page to see your results here.</p>',
        '</div>'
      ].join('');
    }

    var rows = quizzes
      .map(function (quiz) {
        return [
          '<li class="learning-my-learning__quiz-row">',
          '<a href="' + lessonUrl(quiz.handle) + '">' + escapeHtml(quiz.title) + '</a>',
          '<span>' + quiz.score + ' / ' + quiz.total + ' (' + quiz.percent + '%)</span>',
          '</li>'
        ].join('');
      })
      .join('');

    return [
      '<div class="learning-my-learning__section">',
      '<div class="learning-hub__section-heading"><div><p class="learning-hub__eyebrow">Knowledge Check Results</p><h2>Your quiz results</h2></div></div>',
      '<p class="learning-my-learning__quiz-note">Your most recent result for each lesson.</p>',
      '<ul class="learning-my-learning__quiz-list">' + rows + '</ul>',
      '</div>'
    ].join('');
  }

  function activityLabel(event) {
    if (event.type === 'quiz') return 'Scored ' + event.score + '/' + event.total + ' on';
    if (event.type === 'completed') return 'Completed';
    return 'Viewed';
  }

  function renderRecentActivity(recentActivity) {
    if (!recentActivity.length) return '';
    var rows = recentActivity
      .map(function (event) {
        return [
          '<li class="learning-my-learning__activity-row">',
          '<span class="learning-my-learning__activity-label">' + activityLabel(event) + '</span>',
          '<a href="' + lessonUrl(event.lesson_id) + '">' + escapeHtml(event.title || event.lesson_id) + '</a>',
          '<span class="learning-my-learning__activity-date">' + formatDate(event.at) + '</span>',
          '</li>'
        ].join('');
      })
      .join('');

    return [
      '<div class="learning-my-learning__section">',
      '<div class="learning-hub__section-heading"><div><p class="learning-hub__eyebrow">Recent Activity</p><h2>What you&rsquo;ve been up to</h2></div></div>',
      '<ul class="learning-my-learning__activity-list">' + rows + '</ul>',
      '</div>'
    ].join('');
  }

  function renderDashboard(viewModel) {
    var root = document.getElementById('MyLearningDashboard');
    if (!root) return;

    root.innerHTML = [
      renderOverall(viewModel.overall),
      renderContinueLearning(viewModel.continueLearning),
      renderCategories(viewModel.categories),
      renderLessons(viewModel.lessons),
      renderQuizzes(viewModel.quizzes),
      renderRecentActivity(viewModel.recentActivity)
    ].join('');

    showState('MyLearningDashboard');
  }

  function wireRetryButtons() {
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

  function init() {
    wireRetryButtons();
    document.addEventListener('oo:learning-progress-ready', loadDashboard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
