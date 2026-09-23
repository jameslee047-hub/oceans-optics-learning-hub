// GET /admin (rewritten from /api/admin -- see vercel.json) -- the
// internal Learning Analytics dashboard shell. A single self-contained
// HTML document (no build step, no theme dependency): this is server-only
// tooling, entirely separate from the Shopify storefront theme.
//
// Protected by the same lib/require-admin.js Basic Auth check as every
// /api/admin/* JSON endpoint it calls; the browser caches those
// credentials per-origin after the first prompt on this page, so the
// fetch() calls below need no explicit Authorization header of their own.
import { requireAdmin } from "../../lib/require-admin.js";

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Oceans Optics &mdash; Learning Analytics</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  :root {
    --blue: #023059;
    --blue-rgb: 2, 48, 89;
    --orange: #b95e05;
    --orange-rgb: 185, 94, 5;
    --ink: #12263a;
    --muted: #52697d;
    --line: rgba(2, 48, 89, 0.14);
    --panel: #ffffff;
    --bg: #f4f6f8;
    --success: #15803d;
    --danger: #b91c1c;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: 'Lato', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.45;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.1rem 1.6rem;
    background: var(--blue);
    color: #fff;
    flex-wrap: wrap;
  }
  header h1 { margin: 0; font-size: 1.25rem; font-weight: 900; }
  header p { margin: 0; font-size: 0.8rem; opacity: 0.75; }
  main { max-width: 128rem; margin: 0 auto; padding: 1.6rem; display: grid; gap: 1.6rem; }
  section { background: var(--panel); border: 1px solid var(--line); border-radius: 0.6rem; padding: 1.2rem 1.4rem; }
  section h2 { margin: 0 0 0.9rem; font-size: 1.05rem; color: var(--blue); }
  .section-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.8rem; margin-bottom: 0.9rem; }
  .section-head h2 { margin: 0; }
  .range-controls { display: flex; gap: 0.4rem; }
  .range-controls button {
    border: 1px solid var(--line);
    background: #fff;
    color: var(--blue);
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .range-controls button.active { background: var(--orange); border-color: var(--orange); color: #fff; }
  .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.9rem; }
  .metric-card { border: 1px solid var(--line); border-radius: 0.5rem; padding: 0.9rem 1rem; background: #fbfcfd; }
  .metric-card .value { font-size: 1.9rem; font-weight: 900; color: var(--blue); line-height: 1.1; }
  .metric-card .label { color: var(--muted); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; margin-top: 0.3rem; }
  .metric-card .na { color: var(--muted); font-size: 0.75rem; font-style: italic; margin-top: 0.2rem; }
  .tracking-note { margin: 0 0 1rem; padding: 0.6rem 0.9rem; border-radius: 0.4rem; background: rgba(var(--blue-rgb), 0.06); color: var(--muted); font-size: 0.8rem; }
  .section-note { margin: -0.4rem 0 0.9rem; color: var(--muted); font-size: 0.8rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th, td { text-align: left; padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--line); white-space: nowrap; }
  th { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; cursor: pointer; user-select: none; }
  th.sorted { color: var(--orange); }
  tbody tr:hover { background: #fbfcfd; }
  .table-scroll { overflow-x: auto; }
  .pill { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px; font-weight: 700; font-size: 0.75rem; }
  .pill.good { background: rgba(21, 128, 61, 0.12); color: var(--success); }
  .pill.bad { background: rgba(185, 28, 28, 0.12); color: var(--danger); }
  .pill.neutral { background: rgba(var(--blue-rgb), 0.08); color: var(--blue); }
  .empty-state, .loading-state, .error-state { padding: 1.2rem; text-align: center; color: var(--muted); }
  .error-state { color: var(--danger); }
  .error-state button { margin-top: 0.6rem; }
  button.link-button {
    border: none; background: none; color: var(--blue); font: inherit; font-weight: 700; cursor: pointer; padding: 0; text-decoration: underline;
  }
  .sample-size { color: var(--muted); font-size: 0.75rem; }
  .review-card { border: 1px solid var(--line); border-radius: 0.5rem; padding: 0.8rem 1rem; margin-bottom: 0.6rem; background: #fbfcfd; }
  .review-card .q { font-weight: 700; color: var(--blue); }
  .review-card .meta { color: var(--muted); font-size: 0.78rem; margin-top: 0.2rem; }
  #learnerDetail {
    position: fixed; inset: 0; background: rgba(2, 48, 89, 0.45); display: flex; align-items: flex-start; justify-content: center;
    padding: 3rem 1.5rem; z-index: 10;
  }
  #learnerDetail[hidden] { display: none; }
  #learnerDetailPanel { background: #fff; border-radius: 0.6rem; max-width: 72rem; width: 100%; max-height: 88vh; overflow-y: auto; padding: 1.6rem; }
  #learnerDetailPanel .close-row { display: flex; justify-content: flex-end; }
  .answer-list { list-style: none; margin: 0.5rem 0 0; padding: 0; display: grid; gap: 0.4rem; }
  .answer-list li { padding: 0.5rem 0.7rem; border-radius: 0.4rem; background: #fbfcfd; font-size: 0.82rem; }
  .answer-list li.correct { border-left: 3px solid var(--success); }
  .answer-list li.incorrect { border-left: 3px solid var(--danger); }
  @media (max-width: 700px) {
    table, thead, tbody, th, td, tr { display: block; }
    thead { display: none; }
    tbody tr { border-bottom: 2px solid var(--line); padding: 0.5rem 0; }
    td { border: 0; padding: 0.25rem 0; }
    td::before { content: attr(data-label); display: block; color: var(--muted); font-size: 0.7rem; text-transform: uppercase; font-weight: 700; }
  }
</style>
</head>
<body>
<header>
  <div>
    <h1>Learning Analytics</h1>
    <p>Internal &mdash; Oceans Optics staff only</p>
  </div>
</header>
<main>
  <section id="summarySection">
    <div class="section-head">
      <h2>Summary</h2>
      <div class="range-controls" id="rangeControls">
        <button data-range="today">Today</button>
        <button data-range="7d">Last 7 days</button>
        <button data-range="30d">Last 30 days</button>
        <button data-range="all" class="active">All time</button>
      </div>
    </div>
    <p id="trackingNote" class="tracking-note" hidden></p>
    <div id="summaryBody" class="loading-state">Loading summary&hellip;</div>
  </section>

  <section id="lessonsSection">
    <h2>Lesson performance</h2>
    <p class="section-note">
      &ldquo;Learners started&rdquo; and completions are all-time (from saved progress, covering activity from before
      tracking began too). &ldquo;Views&rdquo; and their unique-viewer count are event occurrences recorded since
      activity tracking began -- see the note above.
    </p>
    <div id="lessonsBody" class="loading-state">Loading lessons&hellip;</div>
  </section>

  <section id="questionsSection">
    <h2>Questions to review</h2>
    <p class="section-note">
      Based on each learner's current/latest stored Knowledge Check result for that lesson -- a retake replaces their
      previous answers, so this is not a full history of every attempt ever made.
    </p>
    <div id="questionsBody" class="loading-state">Loading questions&hellip;</div>
  </section>

  <section id="learnersSection">
    <h2>Learners</h2>
    <div id="learnersBody" class="loading-state">Loading learners&hellip;</div>
  </section>
</main>

<div id="learnerDetail" hidden>
  <div id="learnerDetailPanel">
    <div class="close-row"><button class="link-button" id="closeLearnerDetail">Close</button></div>
    <div id="learnerDetailBody"></div>
  </div>
</div>

<script>
(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fetchJson(path) {
    return fetch(path, { headers: { Accept: 'application/json' } }).then(function (response) {
      if (!response.ok) throw new Error('request_failed:' + response.status);
      return response.json();
    });
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return '—'; }
  }

  function metricCard(value, label, note) {
    return '<div class="metric-card"><div class="value">' + escapeHtml(value) + '</div><div class="label">' + escapeHtml(label) + '</div>' +
      (note ? '<div class="na">' + escapeHtml(note) + '</div>' : '') + '</div>';
  }

  // ---------------- Summary ----------------
  var currentRange = 'all';

  function loadSummary() {
    var body = document.getElementById('summaryBody');
    body.className = 'loading-state';
    body.textContent = 'Loading summary…';

    fetchJson('/api/admin/summary?range=' + encodeURIComponent(currentRange)).then(function (summary) {
      var note = document.getElementById('trackingNote');
      if (!summary.hasEventData) {
        note.hidden = false;
        note.textContent = 'No activity has been tracked yet. Behavioural metrics below (active learners, views, completions, Knowledge Checks, returning learners) will populate once learners start using the Learning Hub after this feature launches. Total authenticated learners still reflects all-time signups.';
      } else {
        note.hidden = false;
        note.textContent = 'Activity tracking since ' + formatDate(summary.trackingStartedAt) + '. Behavioural metrics below only cover activity from that point forward -- they are not a complete history for periods before it.';
      }

      var cards = [
        metricCard(summary.totalLearners, 'Total authenticated learners'),
        metricCard(summary.activeLearners, 'Active learners (period)'),
        metricCard(summary.lessonViews, 'Lesson views (period)'),
        metricCard(summary.lessonCompletions, 'Lesson completions (period)'),
        metricCard(summary.completionRate + '%', 'Completion rate (period)'),
        metricCard(summary.quizzesCompleted, 'Knowledge Checks completed (period)'),
        metricCard(summary.avgQuizPercent === null ? '—' : summary.avgQuizPercent + '%', 'Avg Knowledge Check score (period)'),
        summary.returningLearners === null
          ? metricCard('—', 'Returning learners', 'Not enough activity history yet')
          : metricCard(summary.returningLearners, 'Returning learners')
      ];
      body.className = '';
      body.innerHTML = '<div class="metric-grid">' + cards.join('') + '</div>';
    }).catch(function () {
      body.className = 'error-state';
      body.innerHTML = 'Could not load summary metrics. <button class="link-button" onclick="void 0">Retry</button>';
      body.querySelector('button').addEventListener('click', loadSummary);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('#rangeControls button'), function (button) {
    button.addEventListener('click', function () {
      currentRange = button.getAttribute('data-range');
      Array.prototype.forEach.call(document.querySelectorAll('#rangeControls button'), function (b) { b.classList.remove('active'); });
      button.classList.add('active');
      loadSummary();
    });
  });

  // ---------------- Lessons ----------------
  var lessonsData = [];
  var lessonSort = { key: 'learnersStarted', dir: -1 };

  var LESSON_COLUMNS = [
    { key: 'title', label: 'Lesson' },
    { key: 'category_title', label: 'Category' },
    { key: 'learnersStarted', label: 'Learners started' },
    { key: 'completions', label: 'Completions' },
    { key: 'completionRate', label: 'Completion %' },
    { key: 'viewEvents', label: 'Views' },
    { key: 'uniqueViewersFromEvents', label: 'Unique viewers' },
    { key: 'quizCount', label: 'Knowledge Checks' },
    { key: 'avgQuizPercent', label: 'Avg score' },
    { key: 'mostMissedQuestion', label: 'Most missed question' }
  ];

  function renderLessons() {
    var body = document.getElementById('lessonsBody');
    if (!lessonsData.length) {
      body.className = 'empty-state';
      body.textContent = 'No lesson activity recorded yet.';
      return;
    }

    var sorted = lessonsData.slice().sort(function (a, b) {
      var av = a[lessonSort.key];
      var bv = b[lessonSort.key];
      if (lessonSort.key === 'mostMissedQuestion') {
        av = a.mostMissedQuestion ? a.mostMissedQuestion.incorrectCount : -1;
        bv = b.mostMissedQuestion ? b.mostMissedQuestion.incorrectCount : -1;
      }
      if (av === null || av === undefined) av = -1;
      if (bv === null || bv === undefined) bv = -1;
      if (av < bv) return -1 * lessonSort.dir;
      if (av > bv) return 1 * lessonSort.dir;
      return 0;
    });

    var head = LESSON_COLUMNS.map(function (col) {
      return '<th data-key="' + col.key + '" class="' + (lessonSort.key === col.key ? 'sorted' : '') + '">' + escapeHtml(col.label) +
        (lessonSort.key === col.key ? (lessonSort.dir === 1 ? ' ↑' : ' ↓') : '') + '</th>';
    }).join('');

    var rows = sorted.map(function (lesson) {
      var missed = lesson.mostMissedQuestion
        ? escapeHtml(lesson.mostMissedQuestion.question) + ' <span class="sample-size">(' + lesson.mostMissedQuestion.incorrectCount + '/' + lesson.mostMissedQuestion.sampleSize + ' missed)</span>'
        : '<span class="sample-size">No answer data</span>';
      return '<tr>' +
        '<td data-label="Lesson">' + escapeHtml(lesson.title) + '</td>' +
        '<td data-label="Category">' + escapeHtml(lesson.category_title) + '</td>' +
        '<td data-label="Learners started">' + lesson.learnersStarted + '</td>' +
        '<td data-label="Completions">' + lesson.completions + '</td>' +
        '<td data-label="Completion %">' + lesson.completionRate + '%</td>' +
        '<td data-label="Views">' + lesson.viewEvents + '</td>' +
        '<td data-label="Unique viewers">' + lesson.uniqueViewersFromEvents + '</td>' +
        '<td data-label="Knowledge Checks">' + lesson.quizCount + '</td>' +
        '<td data-label="Avg score">' + (lesson.avgQuizPercent === null ? '—' : lesson.avgQuizPercent + '%') + '</td>' +
        '<td data-label="Most missed question">' + missed + '</td>' +
        '</tr>';
    }).join('');

    body.className = 'table-scroll';
    body.innerHTML = '<table><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table>';

    Array.prototype.forEach.call(body.querySelectorAll('th'), function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-key');
        if (lessonSort.key === key) lessonSort.dir *= -1;
        else { lessonSort.key = key; lessonSort.dir = -1; }
        renderLessons();
      });
    });
  }

  function loadLessons() {
    var body = document.getElementById('lessonsBody');
    fetchJson('/api/admin/lessons').then(function (data) {
      lessonsData = data.lessons || [];
      renderLessons();
    }).catch(function () {
      body.className = 'error-state';
      body.innerHTML = 'Could not load lesson performance. <button class="link-button">Retry</button>';
      body.querySelector('button').addEventListener('click', loadLessons);
    });
  }

  // ---------------- Questions to review ----------------
  function loadQuestions() {
    var body = document.getElementById('questionsBody');
    fetchJson('/api/admin/questions').then(function (data) {
      var list = data.questionsToReview || [];
      if (!list.length) {
        body.className = 'empty-state';
        body.textContent = 'No questions with incorrect answers yet (or no answer data recorded).';
        return;
      }
      body.className = '';
      body.innerHTML = list.slice(0, 20).map(function (q) {
        return '<div class="review-card">' +
          '<div class="q">' + escapeHtml(q.question) + '</div>' +
          '<div class="meta">' + escapeHtml(q.lesson_title) + ' &middot; ' + q.percentIncorrect + '% incorrect' +
          ' <span class="sample-size">(n=' + q.answeredCount + ')</span>' +
          (q.mostCommonIncorrectAnswer ? ' &middot; Most common wrong answer: ' + escapeHtml(q.mostCommonIncorrectAnswer) : '') +
          '</div></div>';
      }).join('');
    }).catch(function () {
      body.className = 'error-state';
      body.innerHTML = 'Could not load question analytics. <button class="link-button">Retry</button>';
      body.querySelector('button').addEventListener('click', loadQuestions);
    });
  }

  // ---------------- Learners ----------------
  function renderLearners(learners) {
    var body = document.getElementById('learnersBody');
    if (!learners.length) {
      body.className = 'empty-state';
      body.textContent = 'No authenticated learners yet.';
      return;
    }

    var rows = learners.map(function (learner) {
      return '<tr data-id="' + escapeHtml(learner.learning_user_id) + '">' +
        '<td data-label="Customer ID">' + escapeHtml(learner.shopify_customer_id) + '</td>' +
        '<td data-label="Last activity">' + formatDate(learner.last_activity_at) + '</td>' +
        '<td data-label="Lessons started">' + learner.lessons_started + '</td>' +
        '<td data-label="Lessons completed">' + learner.lessons_completed + '</td>' +
        '<td data-label="Completion %">' + learner.completion_percent + '%</td>' +
        '<td data-label="Knowledge Checks">' + learner.quizzes_completed + '</td>' +
        '<td data-label="Avg score">' + (learner.avg_quiz_percent === null ? '—' : learner.avg_quiz_percent + '%') + '</td>' +
        '<td data-label="Detail"><button class="link-button" data-view="' + escapeHtml(learner.learning_user_id) + '">View</button></td>' +
        '</tr>';
    }).join('');

    body.className = 'table-scroll';
    body.innerHTML = '<table><thead><tr>' +
      '<th>Customer ID</th><th>Last activity</th><th>Started</th><th>Completed</th><th>Completion %</th><th>Knowledge Checks</th><th>Avg score</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';

    Array.prototype.forEach.call(body.querySelectorAll('[data-view]'), function (btn) {
      btn.addEventListener('click', function () { openLearnerDetail(btn.getAttribute('data-view')); });
    });
  }

  function loadLearners() {
    var body = document.getElementById('learnersBody');
    fetchJson('/api/admin/learners').then(function (data) {
      renderLearners(data.learners || []);
    }).catch(function () {
      body.className = 'error-state';
      body.innerHTML = 'Could not load learners. <button class="link-button">Retry</button>';
      body.querySelector('button').addEventListener('click', loadLearners);
    });
  }

  // ---------------- Learner detail ----------------
  function renderAnswerList(answers) {
    if (!Array.isArray(answers) || !answers.length) return '<p class="sample-size">Answer review unavailable for this earlier result.</p>';
    return '<ul class="answer-list">' + answers.map(function (a) {
      var cls = a.is_correct ? 'correct' : 'incorrect';
      var line = a.is_correct
        ? '✓ ' + escapeHtml(a.question) + ' &mdash; ' + escapeHtml(a.selected)
        : '✕ ' + escapeHtml(a.question) + ' &mdash; selected: ' + escapeHtml(a.selected) + ', correct: ' + escapeHtml(a.correct);
      return '<li class="' + cls + '">' + line + '</li>';
    }).join('') + '</ul>';
  }

  function openLearnerDetail(id) {
    var overlay = document.getElementById('learnerDetail');
    var body = document.getElementById('learnerDetailBody');
    body.innerHTML = '<p class="loading-state">Loading learner…</p>';
    overlay.hidden = false;

    fetchJson('/api/admin/learners/' + encodeURIComponent(id)).then(function (detail) {
      var completed = detail.completedLessons.map(function (l) {
        return '<li>' + escapeHtml(l.title) + ' <span class="sample-size">(' + formatDate(l.completed_at) + ')</span></li>';
      }).join('') || '<li class="sample-size">None yet</li>';
      var inProgress = detail.inProgressLessons.map(function (l) {
        return '<li>' + escapeHtml(l.title) + '</li>';
      }).join('') || '<li class="sample-size">None</li>';
      var quizzes = detail.quizzes.map(function (q) {
        return '<div class="review-card"><div class="q">' + escapeHtml(q.title) + ' &mdash; ' + q.score + '/' + q.total + ' (' + q.percent + '%)</div>' +
          renderAnswerList(q.answers) + '</div>';
      }).join('') || '<p class="sample-size">No Knowledge Checks completed yet.</p>';
      var timeline = detail.timeline.map(function (e) {
        return '<li>' + escapeHtml(e.event_type) + (e.lesson_id ? ' &middot; ' + escapeHtml(e.lesson_id) : '') + ' <span class="sample-size">' + formatDate(e.created_at) + '</span></li>';
      }).join('') || '<li class="sample-size">No recorded activity events.</li>';

      body.innerHTML =
        '<h2>Learner ' + escapeHtml(detail.shopify_customer_id) + '</h2>' +
        '<p><strong>' + detail.overall.percent + '%</strong> complete (' + detail.overall.completedCount + ' of ' + detail.overall.totalCount + ' lessons)</p>' +
        '<h3>Completed lessons</h3><ul>' + completed + '</ul>' +
        '<h3>In progress / viewed</h3><ul>' + inProgress + '</ul>' +
        '<h3>Knowledge Check results</h3>' + quizzes +
        '<h3>Activity timeline</h3><ul>' + timeline + '</ul>';
    }).catch(function () {
      body.innerHTML = '<p class="error-state">Could not load this learner.</p>';
    });
  }

  document.getElementById('closeLearnerDetail').addEventListener('click', function () {
    document.getElementById('learnerDetail').hidden = true;
  });

  loadSummary();
  loadLessons();
  loadQuestions();
  loadLearners();
})();
</script>
</body>
</html>
`;

export default function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(HTML);
}
