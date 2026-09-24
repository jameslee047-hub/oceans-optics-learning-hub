// GET /admin (rewritten to /api/admin/dashboard -- see vercel.json) -- the
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
  html, body { max-width: 100%; overflow-x: hidden; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: 'Lato', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.45;
  }
  header {
    padding: 1.1rem 1.6rem;
    background: var(--blue);
    color: #fff;
  }
  .header-inner { width: 100%; max-width: 80rem; margin: 0 auto; }
  header h1 { margin: 0; font-size: 1.25rem; font-weight: 900; }
  header p { margin: 0; font-size: 0.8rem; opacity: 0.75; }
  main { width: 100%; max-width: 80rem; min-width: 0; margin: 0 auto; padding: 1.5rem; display: grid; gap: 1.25rem; }
  section { min-width: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 0.5rem; padding: 1.1rem 1.25rem; }
  section h2 { margin: 0 0 0.9rem; font-size: 1.05rem; color: var(--blue); }
  .section-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.8rem; margin-bottom: 0.9rem; }
  .section-head h2 { margin: 0; }
  .range-controls { display: flex; gap: 0.4rem; flex-wrap: wrap; }
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
  .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.8rem; }
  .metric-card { min-height: 6.75rem; border: 1px solid var(--line); border-radius: 0.4rem; padding: 0.9rem 1rem; background: #fbfcfd; }
  .metric-card .value { font-size: 2rem; font-weight: 900; color: var(--blue); line-height: 1.1; }
  .metric-card .label { color: var(--muted); font-size: 0.78rem; line-height: 1.35; font-weight: 700; text-transform: uppercase; margin-top: 0.4rem; }
  .metric-card .na { color: var(--muted); font-size: 0.75rem; font-style: italic; margin-top: 0.2rem; }
  .tracking-note { margin: 0 0 1rem; padding: 0.6rem 0.9rem; border-radius: 0.4rem; background: rgba(var(--blue-rgb), 0.06); color: var(--muted); font-size: 0.8rem; }
  .section-note { margin: -0.4rem 0 0.9rem; color: var(--muted); font-size: 0.8rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th, td { text-align: left; padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--line); white-space: nowrap; }
  th { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; cursor: pointer; user-select: none; }
  th.sorted { color: var(--orange); }
  tbody tr:hover { background: #fbfcfd; }
  .table-scroll { max-width: 100%; overflow-x: auto; overscroll-behavior-inline: contain; }
  #lessonsBody table { min-width: 92rem; }
  #lessonsBody th:first-child,
  #lessonsBody td:first-child { position: sticky; left: 0; z-index: 1; min-width: 13rem; max-width: 17rem; white-space: normal; background: #fff; box-shadow: 1px 0 0 var(--line); }
  #lessonsBody th:first-child { z-index: 2; }
  #lessonsBody tbody tr:hover td:first-child { background: #fbfcfd; }
  #lessonsBody th:last-child,
  #lessonsBody td:last-child { min-width: 15rem; white-space: normal; }
  #learnersBody table { min-width: 60rem; }
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
  #questionsBody { width: 100%; max-width: 58rem; }
  #learnerDetail {
    position: fixed; inset: 0; background: rgba(2, 48, 89, 0.45); display: flex; align-items: flex-start; justify-content: center;
    padding: 3rem 1.5rem; z-index: 10;
  }
  #learnerDetail[hidden] { display: none; }
  #learnerDetailPanel { background: #fff; border-radius: 0.6rem; max-width: 56rem; width: 100%; max-height: calc(100vh - 4rem); overflow-y: auto; padding: 1.4rem; }
  #learnerDetailPanel .close-row { display: flex; justify-content: flex-end; }
  .answer-list { list-style: none; margin: 0.5rem 0 0; padding: 0; display: grid; gap: 0.4rem; }
  .answer-list li { padding: 0.5rem 0.7rem; border-radius: 0.4rem; background: #fbfcfd; font-size: 0.82rem; }
  .answer-list li.correct { border-left: 3px solid var(--success); }
  .answer-list li.incorrect { border-left: 3px solid var(--danger); }
  .subsection-title { margin: 1.3rem 0 0.5rem; font-size: 0.78rem; font-weight: 900; color: var(--blue); text-transform: uppercase; letter-spacing: 0.03em; }
  .funnel-cohort-note { color: var(--muted); font-size: 0.8rem; margin-bottom: 0.9rem; }
  .funnel-row { display: grid; grid-template-columns: 13rem 1fr 18rem; gap: 0.9rem; align-items: center; padding: 0.5rem 0; min-width: 0; }
  .funnel-row-label { font-weight: 700; color: var(--blue); font-size: 0.85rem; }
  .funnel-row-bar-track { background: rgba(var(--blue-rgb), 0.08); border-radius: 999px; height: 1rem; overflow: hidden; min-width: 0; }
  .funnel-row-bar { background: var(--orange); height: 100%; border-radius: 999px; }
  .funnel-row-figures { font-size: 0.78rem; color: var(--muted); }
  #categoriesBody table { min-width: 56rem; }
  .flag-card { border-left: 3px solid var(--orange); border-radius: 0.4rem; padding: 0.65rem 0.9rem; margin-bottom: 0.5rem; background: #fbfcfd; font-size: 0.85rem; }
  .flag-card .flag-title { font-weight: 700; color: var(--blue); }
  .flag-card .flag-metric { color: var(--muted); font-size: 0.78rem; margin-top: 0.15rem; }
  .questions-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.8rem; }
  .questions-toolbar .section-note { margin: 0; }
  @media (max-width: 1100px) {
    .metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 820px) {
    .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 700px) {
    header, main { padding-left: 1rem; padding-right: 1rem; }
    main { gap: 1rem; }
    section { padding: 1rem; }
    table, thead, tbody, th, td, tr { display: block; }
    #lessonsBody table, #learnersBody table { min-width: 0; }
    thead { display: none; }
    tbody tr { border-bottom: 2px solid var(--line); padding: 0.5rem 0; }
    td { border: 0; padding: 0.25rem 0; white-space: normal; }
    #lessonsBody th:first-child, #lessonsBody td:first-child { position: static; min-width: 0; max-width: none; box-shadow: none; background: transparent; }
    #lessonsBody tbody tr:hover td:first-child { background: transparent; }
    td::before { content: attr(data-label); display: block; color: var(--muted); font-size: 0.7rem; text-transform: uppercase; font-weight: 700; }
    #learnerDetail { padding: 1rem; }
    #learnerDetailPanel { max-height: calc(100vh - 2rem); padding: 1rem; }
    .funnel-row { grid-template-columns: 1fr; gap: 0.3rem; }
    #categoriesBody table { min-width: 0; }
  }
  @media (max-width: 560px) {
    .metric-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<header>
  <div class="header-inner">
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

  <section id="funnelSection">
    <h2>Learning Hub funnel</h2>
    <p class="section-note">
      Ordered, hub-first journey for the selected period: a visitor advances to the next stage only via an event that
      happened at or after they reached the stage before it &mdash; this is not independent event counts. Visitors who
      reach a category, lesson, or Knowledge Check without first viewing the Learning Hub in this period (search,
      email, a direct link, or a hub visit outside this window) are never counted as funnel drop-off &mdash; see
      &ldquo;Direct entrants&rdquo; below instead.
    </p>
    <div id="funnelBody" class="loading-state">Loading funnel&hellip;</div>

    <div class="subsection-title">Direct entrants (skipped the Learning Hub)</div>
    <div id="directEntrantsBody" class="loading-state">Loading&hellip;</div>

    <div class="subsection-title">Continuing to another lesson</div>
    <p class="section-note">
      &ldquo;Another lesson&rdquo; always means a different lesson than the one already viewed &mdash; repeat views of
      the same lesson are never counted as progression. Covers every visitor, including direct entrants.
    </p>
    <div id="continueLearningBody" class="loading-state">Loading&hellip;</div>

    <div class="subsection-title">Repeat visits within this period</div>
    <p class="section-note">
      Multiple inferred visit sessions (a 30+ minute gap starts a new session), or activity on 2+ distinct calendar
      days, using only events inside the selected date range. For visitors already active before this period began,
      see &ldquo;Returning visitors&rdquo; in Summary instead.
    </p>
    <div id="returningDetailBody" class="loading-state">Loading&hellip;</div>
  </section>

  <section id="categoriesSection">
    <h2>Category performance</h2>
    <p class="section-note">
      Category page views, unique lesson viewers, and Knowledge Checks completed for the selected period, using the
      published catalogue&rsquo;s real categories and lesson counts. &ldquo;Visitor &rarr; lesson&rdquo; only counts a
      lesson view that happened at or after the category page view (ordered progression, not an independent count).
    </p>
    <div id="categoriesBody" class="loading-state">Loading categories&hellip;</div>
  </section>

  <section id="lessonsSection">
    <h2>Lesson performance</h2>
    <p class="section-note">
      &ldquo;Learners started&rdquo; and completions are all-time (from saved progress, covering activity from before
      tracking began too) and authenticated-only. Views, unique viewers, viewer&rarr;quiz rate, incorrect-answer rate,
      and follow-on rate include authenticated and consented anonymous event traffic for the selected period.
      Viewer&rarr;quiz is the share of unique viewers who also attempted the Knowledge Check &mdash; not an
      authenticated-only completion rate. Avg incorrect % is a difficulty indicator across every recorded answer, not
      a quality score. Follow-on % is the share of viewers who went on to view a different lesson afterward.
    </p>
    <div id="lessonsBody" class="loading-state">Loading lessons&hellip;</div>
  </section>

  <section id="questionsSection">
    <h2>Questions to review</h2>
    <p class="section-note">
      Based on recorded Knowledge Check attempts from authenticated and consented anonymous visitors, ranked by
      highest incorrect % (ties broken by larger sample size). Historical events created before answer snapshots were
      added do not contribute to question-level samples.
    </p>
    <div id="questionsBody" class="loading-state">Loading questions&hellip;</div>
  </section>

  <section id="improvementSection">
    <h2>Potential improvement areas</h2>
    <p class="section-note">
      Transparent, rule-based flags computed only from the metrics above &mdash; never a quality judgement or a
      causal claim. Each flag names the exact metric and sample size behind it.
    </p>
    <div id="improvementBody" class="empty-state">Waiting for lesson and category data&hellip;</div>
  </section>

  <section id="learnersSection">
    <h2>Learners</h2>
    <p class="section-note">
      Names are looked up from Shopify on demand for this page only and are never stored outside Shopify &mdash; if a
      lookup is unavailable, the customer ID is shown instead. Anonymous visitors are never listed here.
    </p>
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

  function metricCard(value, label, note, tooltip) {
    return '<div class="metric-card"' + (tooltip ? ' title="' + escapeHtml(tooltip) + '"' : '') + '>' +
      '<div class="value">' + escapeHtml(value) + '</div><div class="label">' + escapeHtml(label) + '</div>' +
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
        note.textContent = 'Activity tracking since ' + formatDate(summary.trackingStartedAt) + '. Anonymous visitor tracking ' +
          (summary.anonymousTrackingStartedAt ? 'since ' + formatDate(summary.anonymousTrackingStartedAt) : 'has not recorded data yet') +
          '. Behavioural metrics only cover activity recorded after each tracking start; no anonymous history is inferred.';
      }

      var cards = [
        metricCard(summary.visitors, 'Visitors (period)', 'Anonymous + authenticated'),
        metricCard(summary.anonymousVisitors, 'Anonymous visitors (period)'),
        metricCard(summary.authenticatedVisitors, 'Authenticated visitors (period)'),
        metricCard(summary.totalLearners, 'Total authenticated learners'),
        metricCard(summary.activeLearners, 'Active learners (period)'),
        metricCard(
          summary.lessonViews,
          'Lesson views (period)',
          'Raw view events',
          'Raw lesson_viewed event count -- a learner revisiting the same lesson counts again each time. Not deduplicated.'
        ),
        metricCard(
          summary.uniqueLessonPairsViewed,
          'Authenticated unique lessons viewed (period)',
          'Distinct learner + lesson pairs',
          'Distinct authenticated (learner, lesson) pairs with at least one view in this period. Anonymous views are included in raw lesson views but not this saved-progress conversion denominator.'
        ),
        metricCard(summary.lessonCompletions, 'Authenticated lesson completions (period)'),
        metricCard(
          summary.lessonConversionRate + '%',
          'Authenticated lesson conversion (period)',
          summary.uniqueViewedPairsCompleted + ' of ' + summary.uniqueLessonPairsViewed + ' viewed pairs also completed',
          'Viewed → completed: of the distinct learner+lesson pairs first viewed in this period, the % that were ALSO completed within this SAME period. Deduplicated by learner+lesson, never a raw completions÷views ratio (a learner revisiting a lesson without a matching completion would otherwise wrongly lower this number).'
        ),
        metricCard(summary.quizzesCompleted, 'Knowledge Checks completed (period)'),
        metricCard(summary.avgQuizPercent === null ? '—' : summary.avgQuizPercent + '%', 'Avg Knowledge Check score (period)'),
        summary.returningVisitors === null
          ? metricCard('—', 'Returning visitors', 'Not enough activity history yet')
          : metricCard(summary.returningVisitors, 'Returning visitors')
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
      loadFunnel();
      loadCategories();
      loadLessons();
    });
  });

  // ---------------- Learning Hub funnel / journey ----------------
  function renderFunnel(funnel) {
    var body = document.getElementById('funnelBody');
    if (!funnel || !funnel.cohortSize) {
      body.className = 'empty-state';
      body.textContent = 'No Learning Hub visits recorded yet for this period.';
      return;
    }
    var maxVisitors = funnel.cohortSize;
    body.className = '';
    body.innerHTML = '<div class="funnel-cohort-note">Cohort: ' + funnel.cohortSize + ' visitor' + (funnel.cohortSize === 1 ? '' : 's') +
      ' who viewed the Learning Hub in this period.</div>' +
      funnel.stages.map(function (stage) {
        var widthPct = maxVisitors > 0 ? Math.round((stage.visitors / maxVisitors) * 100) : 0;
        var figures = stage.visitors + ' visitor' + (stage.visitors === 1 ? '' : 's') + ' &middot; ' + stage.percentOfCohort + '% of cohort' +
          (stage.key === 'hub_viewed' ? '' : ' &middot; ' + stage.conversionFromPrevious + '% from previous stage (' + stage.dropOffFromPrevious + '% drop-off)');
        return '<div class="funnel-row">' +
          '<div class="funnel-row-label">' + escapeHtml(stage.label) + '</div>' +
          '<div class="funnel-row-bar-track"><div class="funnel-row-bar" style="width:' + widthPct + '%"></div></div>' +
          '<div class="funnel-row-figures">' + figures + '</div>' +
          '</div>';
      }).join('');
  }

  function renderDirectEntrants(direct) {
    var body = document.getElementById('directEntrantsBody');
    body.className = 'metric-grid';
    body.innerHTML = [
      metricCard(
        direct.directCategoryEntrants,
        'Direct category entrants',
        direct.totalCategoryViewers + ' total category viewers',
        'Visitors whose first category page view in this period happened before (or without) any Learning Hub view.'
      ),
      metricCard(
        direct.directLessonEntrants,
        'Direct lesson entrants',
        direct.totalLessonViewers + ' total lesson viewers',
        'Visitors whose first lesson view in this period happened before (or without) any Learning Hub view.'
      ),
      metricCard(direct.totalQuizCompleters, 'Knowledge Checks completed', 'All entry paths, hub-first and direct combined')
    ].join('');
  }

  function renderContinueLearning(cl) {
    var body = document.getElementById('continueLearningBody');
    body.className = 'metric-grid';
    body.innerHTML = [
      metricCard(cl.viewedAnotherLessonAfterFirstRate + '%', 'Viewed another lesson after first', cl.viewedAnotherLessonAfterFirst + ' of ' + cl.lessonViewers + ' lesson viewers'),
      metricCard(cl.viewedAnotherLessonAfterQuizRate + '%', 'Viewed another lesson after a Knowledge Check', cl.viewedAnotherLessonAfterQuiz + ' of ' + cl.quizCompleters + ' quiz completers'),
      metricCard(cl.viewedTwoPlusDistinctLessonsRate + '%', '2+ distinct lessons viewed', cl.viewedTwoPlusDistinctLessons + ' of ' + cl.lessonViewers),
      metricCard(cl.viewedThreePlusDistinctLessonsRate + '%', '3+ distinct lessons viewed', cl.viewedThreePlusDistinctLessons + ' of ' + cl.lessonViewers),
      metricCard(cl.continuedSameSession, 'Continued in the same session', 'Inferred from a 30-minute inactivity gap'),
      metricCard(cl.continuedLaterSession, 'Continued in a later session')
    ].join('');
  }

  function renderReturningDetail(rd) {
    var body = document.getElementById('returningDetailBody');
    body.className = 'metric-grid';
    body.innerHTML = [
      metricCard(rd.multipleSessionsRate + '%', 'Multiple sessions in period', rd.visitorsWithMultipleSessions + ' of ' + rd.totalVisitors + ' visitors'),
      metricCard(rd.returnedOnLaterDayRate + '%', 'Active on 2+ distinct days', rd.visitorsReturnedOnLaterDay + ' of ' + rd.totalVisitors + ' visitors')
    ].join('');
  }

  function loadFunnel() {
    var funnelBody = document.getElementById('funnelBody');
    fetchJson('/api/admin/funnel?range=' + encodeURIComponent(currentRange)).then(function (data) {
      renderFunnel(data.funnel);
      renderDirectEntrants(data.directEntrants);
      renderContinueLearning(data.continueLearning);
      renderReturningDetail(data.returningDetail);
    }).catch(function () {
      funnelBody.className = 'error-state';
      funnelBody.innerHTML = 'Could not load the Learning Hub funnel. <button class="link-button">Retry</button>';
      funnelBody.querySelector('button').addEventListener('click', loadFunnel);
      ['directEntrantsBody', 'continueLearningBody', 'returningDetailBody'].forEach(function (id) {
        var body = document.getElementById(id);
        body.className = 'error-state';
        body.textContent = 'Could not load this section.';
      });
    });
  }

  // ---------------- Category performance ----------------
  var categoriesData = [];

  function renderCategories() {
    var body = document.getElementById('categoriesBody');
    if (!categoriesData.length) {
      body.className = 'empty-state';
      body.textContent = 'No category activity recorded yet.';
      return;
    }
    var rows = categoriesData.map(function (category) {
      return '<tr>' +
        '<td data-label="Category">' + escapeHtml(category.title) + '</td>' +
        '<td data-label="Unique visitors">' + category.uniqueVisitors + '</td>' +
        '<td data-label="Category views">' + category.categoryPageViews + '</td>' +
        '<td data-label="Unique lesson viewers">' + category.uniqueLessonViewers + '</td>' +
        '<td data-label="Lessons viewed">' + category.distinctLessonsViewed + ' of ' + category.lessonCount + '</td>' +
        '<td data-label="Knowledge Checks completed">' + category.knowledgeChecksCompleted + '</td>' +
        '<td data-label="Avg quiz score">' + (category.avgQuizPercent === null ? '—' : category.avgQuizPercent + '%') + '</td>' +
        '<td data-label="Visitor → lesson">' + category.visitorToLessonRate + '%</td>' +
        '</tr>';
    }).join('');
    body.className = 'table-scroll';
    body.innerHTML = '<table><thead><tr>' +
      '<th>Category</th><th>Unique visitors</th><th>Category views</th><th>Unique lesson viewers</th><th>Lessons viewed</th><th>Knowledge Checks completed</th><th>Avg quiz score</th><th>Visitor &rarr; lesson</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function loadCategories() {
    var body = document.getElementById('categoriesBody');
    fetchJson('/api/admin/categories?range=' + encodeURIComponent(currentRange)).then(function (data) {
      categoriesData = data.categories || [];
      renderCategories();
      renderImprovementFlags();
    }).catch(function () {
      body.className = 'error-state';
      body.innerHTML = 'Could not load category performance. <button class="link-button">Retry</button>';
      body.querySelector('button').addEventListener('click', loadCategories);
    });
  }

  // ---------------- Potential improvement areas ----------------
  // Thresholds are deliberately simple, fixed, and disclosed here -- these
  // are transparent rule-based flags, never a fabricated "quality score".
  // Minimum sample sizes exist only to avoid overreacting to a handful of
  // visitors; every flag also prints the exact counts behind it.
  var IMPROVEMENT_THRESHOLDS = {
    minLessonViewers: 5,
    lowViewerToQuizRate: 50,
    highIncorrectRate: 30,
    minAnswerSample: 5,
    lowFollowOnRate: 20,
    minCategoryVisitors: 5,
    lowVisitorToLessonRate: 40
  };

  function computeImprovementFlags() {
    var flags = [];
    lessonsData.forEach(function (lesson) {
      if (lesson.uniqueViewersFromEvents >= IMPROVEMENT_THRESHOLDS.minLessonViewers && lesson.viewerToQuizRate < IMPROVEMENT_THRESHOLDS.lowViewerToQuizRate) {
        flags.push({
          title: lesson.title,
          label: 'High traffic, low quiz engagement',
          metric: 'Viewer → quiz: ' + lesson.viewerToQuizRate + '% (' + lesson.uniqueQuizAttemptVisitors + ' of ' + lesson.uniqueViewersFromEvents + ' visitors)'
        });
      }
      if (lesson.questionAnswerSampleSize >= IMPROVEMENT_THRESHOLDS.minAnswerSample && lesson.avgQuestionIncorrectPercent !== null && lesson.avgQuestionIncorrectPercent >= IMPROVEMENT_THRESHOLDS.highIncorrectRate) {
        flags.push({
          title: lesson.title,
          label: 'High incorrect-answer rate',
          metric: lesson.avgQuestionIncorrectPercent + '% of answers incorrect (n=' + lesson.questionAnswerSampleSize + ')'
        });
      }
      if (lesson.uniqueViewersFromEvents >= IMPROVEMENT_THRESHOLDS.minLessonViewers && lesson.followOnRate < IMPROVEMENT_THRESHOLDS.lowFollowOnRate) {
        flags.push({
          title: lesson.title,
          label: 'Low next-lesson continuation',
          metric: 'Follow-on: ' + lesson.followOnRate + '% (' + lesson.followOnVisitors + ' of ' + lesson.uniqueViewersFromEvents + ' visitors)'
        });
      }
    });
    categoriesData.forEach(function (category) {
      if (category.uniqueVisitors >= IMPROVEMENT_THRESHOLDS.minCategoryVisitors && category.visitorToLessonRate < IMPROVEMENT_THRESHOLDS.lowVisitorToLessonRate) {
        flags.push({
          title: category.title,
          label: 'Category attracts visitors but few move to a lesson',
          metric: 'Visitor → lesson: ' + category.visitorToLessonRate + '% (' + category.progressedToLessonVisitors + ' of ' + category.uniqueVisitors + ' visitors)'
        });
      }
    });
    return flags;
  }

  function renderImprovementFlags() {
    var body = document.getElementById('improvementBody');
    var flags = computeImprovementFlags();
    if (!flags.length) {
      body.className = 'empty-state';
      body.textContent = (lessonsData.length || categoriesData.length)
        ? 'No flags for the selected period and thresholds.'
        : 'Waiting for lesson and category data…';
      return;
    }
    body.className = '';
    body.innerHTML = flags.map(function (flag) {
      return '<div class="flag-card"><div class="flag-title">' + escapeHtml(flag.title) + ' &mdash; ' + escapeHtml(flag.label) + '</div>' +
        '<div class="flag-metric">' + escapeHtml(flag.metric) + '</div></div>';
    }).join('');
  }

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
    { key: 'quizAttempts', label: 'Quiz attempts' },
    { key: 'avgQuizAttemptPercent', label: 'Avg attempt score' },
    { key: 'viewerToQuizRate', label: 'Viewer → quiz %' },
    { key: 'avgQuestionIncorrectPercent', label: 'Avg incorrect %' },
    { key: 'followOnRate', label: 'Follow-on %' },
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
        '<td data-label="Quiz attempts">' + lesson.quizAttempts + '</td>' +
        '<td data-label="Avg attempt score">' + (lesson.avgQuizAttemptPercent === null ? '—' : lesson.avgQuizAttemptPercent + '%') + '</td>' +
        '<td data-label="Viewer → quiz %" title="' + lesson.uniqueQuizAttemptVisitors + ' of ' + lesson.uniqueViewersFromEvents + ' visitors">' + lesson.viewerToQuizRate + '%</td>' +
        '<td data-label="Avg incorrect %">' + (lesson.avgQuestionIncorrectPercent === null ? '—' : lesson.avgQuestionIncorrectPercent + '% <span class="sample-size">(n=' + lesson.questionAnswerSampleSize + ')</span>') + '</td>' +
        '<td data-label="Follow-on %" title="' + lesson.followOnVisitors + ' of ' + lesson.uniqueViewersFromEvents + ' visitors">' + lesson.followOnRate + '%</td>' +
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
    fetchJson('/api/admin/lessons?range=' + encodeURIComponent(currentRange)).then(function (data) {
      lessonsData = data.lessons || [];
      renderLessons();
      renderImprovementFlags();
    }).catch(function () {
      body.className = 'error-state';
      body.innerHTML = 'Could not load lesson performance. <button class="link-button">Retry</button>';
      body.querySelector('button').addEventListener('click', loadLessons);
    });
  }

  // ---------------- Questions to review ----------------
  var questionsData = null;
  var questionsShowAll = false;

  function questionCard(q) {
    return '<div class="review-card">' +
      '<div class="q">' + escapeHtml(q.question) + '</div>' +
      '<div class="meta">' + escapeHtml(q.lesson_title) + ' &middot; ' + q.percentIncorrect + '% incorrect' +
      ' <span class="sample-size">(n=' + q.answeredCount + ')</span>' +
      (q.mostCommonIncorrectAnswer ? ' &middot; Most common wrong answer: ' + escapeHtml(q.mostCommonIncorrectAnswer) : '') +
      '</div></div>';
  }

  function renderQuestions() {
    var body = document.getElementById('questionsBody');
    if (!questionsData) return;
    var list = questionsShowAll
      ? (questionsData.questions || []).filter(function (q) { return q.percentIncorrect > 0; })
      : (questionsData.questionsToReview || []);

    var toolbar = '<div class="questions-toolbar">' +
      '<p class="section-note">' + (questionsShowAll
        ? 'Showing every question with at least one incorrect answer, any sample size.'
        : 'Showing questions with at least ' + questionsData.minSampleSize + ' recorded attempts (avoids overreacting to a single response).') +
      '</p>' +
      '<button class="link-button" id="toggleQuestionsSample">' + (questionsShowAll ? 'Show reviewable only' : 'Show all (including small samples)') + '</button>' +
      '</div>';

    body.className = '';
    body.innerHTML = toolbar + (list.length
      ? list.slice(0, 20).map(questionCard).join('')
      : '<p class="empty-state">No questions with incorrect answers yet (or no answer data recorded).</p>');

    document.getElementById('toggleQuestionsSample').addEventListener('click', function () {
      questionsShowAll = !questionsShowAll;
      renderQuestions();
    });
  }

  function loadQuestions() {
    var body = document.getElementById('questionsBody');
    fetchJson('/api/admin/questions').then(function (data) {
      questionsData = data;
      renderQuestions();
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
        '<td data-label="Customer">' + escapeHtml(learner.display_name || learner.fallback_label) + '</td>' +
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
      '<th>Customer</th><th>Customer ID</th><th>Last activity</th><th>Started</th><th>Completed</th><th>Completion %</th><th>Knowledge Checks</th><th>Avg score</th><th></th>' +
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

    fetchJson('/api/admin/learners?id=' + encodeURIComponent(id)).then(function (detail) {
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

      var identityLines = '<p class="sample-size">' +
        'Customer ID: ' + escapeHtml(detail.shopify_customer_id) +
        (detail.email ? ' &middot; ' + escapeHtml(detail.email) : '') +
        (detail.shopify_admin_url ? ' &middot; <a href="' + escapeHtml(detail.shopify_admin_url) + '" target="_blank" rel="noopener noreferrer">View in Shopify</a>' : '') +
        '</p>';

      body.innerHTML =
        '<h2>' + escapeHtml(detail.display_name || detail.fallback_label) + '</h2>' +
        identityLines +
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
  loadFunnel();
  loadCategories();
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
