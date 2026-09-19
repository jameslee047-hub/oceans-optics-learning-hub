(function () {
  var data = window.OOLearningHubPreviewData;
  var root = document.getElementById('LearningHubPreviewRoot');
  var currentScriptSrc = document.currentScript && document.currentScript.src || '';
  var assetCacheVersion = (function () {
    if (!currentScriptSrc) return '';

    try {
      return new URL(currentScriptSrc, window.location.href).searchParams.get('v') || '';
    } catch (error) {
      var match = /[?&]v=([^&#]+)/.exec(currentScriptSrc);
      return match ? match[1] : '';
    }
  }());
  var scriptAssetBase = (function () {
    if (window.OOLearningHubAssetBase) return window.OOLearningHubAssetBase;
    return currentScriptSrc ? currentScriptSrc.replace(/[^/?#]+([?#].*)?$/, '') : '';
  }());

  if (!data || !root) {
    return;
  }

  var startDisplay = {
    R07: { title: 'Are You Ready?', subtitle: 'Health & Readiness' },
    R08: { title: 'Golden Rules', subtitle: 'Safer Snorkeling' },
    R01: { title: 'Choosing a Mask', subtitle: 'Gear & Vision' },
    R10: { title: 'Plan Your Snorkel', subtitle: 'Checklist & Planning' },
    R14: { title: 'Buddy Awareness', subtitle: 'Communication' },
    R17: { title: 'Entry & Exit', subtitle: 'Water Skills' }
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function paragraphs(items) {
    return items.map(function (item) {
      return '<p>' + escapeHtml(item) + '</p>';
    }).join('');
  }

  function lessonByHandle(handle) {
    return data.lessons.find(function (lesson) {
      return lesson.handle === handle;
    });
  }

  function relatedLessonByHandle(handle) {
    return (data.relatedLessonIndex || []).find(function (lesson) {
      return lesson.handle === handle;
    });
  }

  function relatedLessonAnchor(handle) {
    return '#preview-related-' + escapeHtml(handle);
  }

  function categoryByHandle(handle) {
    return data.categories.find(function (category) {
      return category.handle === handle;
    });
  }

  function lessonTitleByHandle(handle, fallback) {
    var lesson = lessonByHandle(handle);
    return lesson && lesson.title ? lesson.title : fallback;
  }

  function humanLessonText(value) {
    return String(value || '').replace(/\bR\d{2}\s+(?=[A-Z])/g, '');
  }

  function assetUrl(filename) {
    if (!filename || !scriptAssetBase) return '';

    try {
      return withAssetCacheVersion(new URL(filename, scriptAssetBase).href);
    } catch (error) {
      return withAssetCacheVersion(scriptAssetBase + filename);
    }
  }

  function withAssetCacheVersion(url) {
    if (!url || !assetCacheVersion) return url;

    try {
      var resolved = new URL(url, window.location.href);
      if (!resolved.searchParams.has('v')) {
        resolved.searchParams.set('v', assetCacheVersion);
      }
      return resolved.href;
    } catch (error) {
      if (/[?&]v=/.test(url)) return url;
      return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(assetCacheVersion);
    }
  }

  function resolveAssetReferences(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('[data-learning-asset-filename]'), function (element) {
      var url = assetUrl(element.getAttribute('data-learning-asset-filename'));
      if (!url) return;

      if (element.tagName === 'VIDEO') {
        var source = element.querySelector('source');
        if (source) source.src = url;
        element.load && element.load();
        return;
      }

      element.src = url;
    });
  }

  function previewNav() {
    var lessonOptions = data.lessons.map(function (lesson) {
      return '<option value="#preview-' + escapeHtml(lesson.lesson_id.toLowerCase()) + '">' + escapeHtml(humanLessonText(lesson.title)) + '</option>';
    }).join('');

    return [
      '<nav class="learning-preview-nav page-width" aria-label="Learning Hub preview navigation">',
      '<span class="learning-preview-nav__label">Dev preview</span>',
      '<a href="#preview-homepage">Homepage</a>',
      '<a href="#preview-category-gear">Gear Category</a>',
      '<select data-preview-jump aria-label="Jump to lesson">',
      '<option value="">Jump to lesson…</option>',
      lessonOptions,
      '</select>',
      '</nav>'
    ].join('');
  }

  function startStepCard(step, index) {
    var display = startDisplay[step.lesson_id] || { title: step.title, subtitle: '' };
    var stepNumber = String(index + 1).padStart(2, '0');

    return [
      '<a class="learning-sequence-card" href="#preview-' + escapeHtml(step.lesson_id.toLowerCase()) + '" aria-label="' + escapeHtml(stepNumber + ' ' + display.title + ' ' + display.subtitle) + '">',
      '<span class="learning-sequence-card__number">' + stepNumber + '</span>',
      '<span class="learning-sequence-card__title">' + escapeHtml(display.title) + '</span>',
      '<span class="learning-sequence-card__bottom">',
      '<span class="learning-sequence-card__subtitle">' + escapeHtml(display.subtitle) + '</span>',
      '<span class="learning-sequence-card__cue" aria-hidden="true">→</span>',
      '</span>',
      '</a>'
    ].join('');
  }

  function topicCard(item, index) {
    var number = String(index + 1).padStart(2, '0');
    var url = item.handle === 'start-here'
      ? '#learning-preview-start-here'
      : item.handle === 'gear-masks-vision' ? '#preview-category-gear' : '#preview-homepage';
    var extraClass = item.handle === 'start-here' ? ' learning-topic-card--pathway' : '';

    return [
      '<a class="learning-topic-card' + extraClass + '" data-topic-card href="' + escapeHtml(url) + '" aria-label="' + escapeHtml(number + ' ' + item.title) + '">',
      '<span class="learning-topic-card__header">',
      '<span class="learning-topic-card__number" aria-hidden="true">' + number + '</span>',
      '<span class="learning-topic-card__title">' + escapeHtml(item.title) + '</span>',
      '</span>',
      '<span class="learning-topic-card__bottom">',
      '<span class="learning-topic-card__description">' + escapeHtml(item.short_description) + '</span>',
      '<span class="learning-topic-card__cue" aria-hidden="true">→</span>',
      '</span>',
      '</a>'
    ].join('');
  }

  function lessonCard(lesson, compact) {
    var meta = lesson.lesson_type
      ? '<span class="learning-card__meta">' + escapeHtml(lesson.lesson_type) + '</span>'
      : '';

    return [
      '<a class="learning-card learning-card--lesson' + (compact ? ' learning-card--compact' : '') + '" href="#preview-' + escapeHtml(lesson.lesson_id.toLowerCase()) + '">',
      meta,
      '<h3>' + escapeHtml(lesson.title) + '</h3>',
      '<p>' + escapeHtml(lesson.short_description) + '</p>',
      '<span class="learning-card__footer">Open lesson preview</span>',
      '</a>'
    ].join('');
  }

  function homepage() {
    var popularLessons = [
      lessonByHandle('choosing-a-mask'),
      lessonByHandle('golden-rules-for-safer-snorkeling'),
      lessonByHandle('currents-and-rip-currents')
    ];
    var browseCards = [{
      handle: 'start-here',
      title: 'Start Here',
      short_description: 'Follow the essential lessons in order and build your confidence step by step.'
    }].concat(data.categories);

    return [
      '<section id="preview-homepage" class="learning-preview-page">',
      '<div class="learning-hub__band learning-preview-hero">',
      '<div class="page-width learning-preview-hero__inner">',
      '<p class="learning-hub__eyebrow">Oceans Optics Education</p>',
      '<h1>' + escapeHtml(data.homepage.heading) + '</h1>',
      '<div class="learning-hub__lead learning-preview-hero__copy">' + paragraphs(data.homepage.intro) + '</div>',
      '<div class="learning-hub__actions">',
      '<a class="button learning-cta" href="#preview-r08">' + escapeHtml(data.homepage.primaryCta) + '</a>',
      '<a class="button learning-cta" href="#learning-preview-topics">' + escapeHtml(data.homepage.secondaryCta) + '</a>',
      '</div>',
      '</div>',
      '</div>',
      '<div id="learning-preview-start-here" class="learning-hub__band learning-hub__band--tinted">',
      '<div class="page-width">',
      '<div class="learning-hub__section-heading learning-hub__section-heading--compact"><div><p class="learning-hub__eyebrow">Start Here</p><h2>' + escapeHtml(data.homepage.startHeading) + '</h2></div><p>' + escapeHtml(data.homepage.startCopy[0]) + '</p></div>',
      '<div class="learning-sequence-grid" aria-label="Start Here beginner pathway">',
      data.startHere.map(startStepCard).join(''),
      '</div>',
      '</div>',
      '</div>',
      '<div class="learning-hub__band">',
      '<div class="page-width learning-knowledge">',
      '<div class="learning-knowledge__visual"><img src="' + escapeHtml(data.homepage.whyImage.url) + '" alt="' + escapeHtml(data.homepage.whyImage.alt) + '" loading="lazy" decoding="async"></div>',
      '<div class="learning-knowledge__copy">',
      '<p class="learning-hub__eyebrow">Why Learn With Oceans Optics</p>',
      '<h2>' + escapeHtml(data.homepage.whyHeading) + '</h2>',
      paragraphs(data.homepage.whyCopy),
      '<ul class="learning-knowledge__points">',
      data.homepage.whyProofPoints.map(function (point) {
        return '<li>' + escapeHtml(point) + '</li>';
      }).join(''),
      '</ul>',
      '</div>',
      '</div>',
      '</div>',
      '<div id="learning-preview-topics" class="learning-hub__band">',
      '<div class="page-width">',
      '<div class="learning-hub__section-heading learning-hub__section-heading--compact"><div><p class="learning-hub__eyebrow">Browse</p><h2>Browse All Topics</h2></div><p>Choose a pathway or subject area, then open the lesson that fits what you want to learn next.</p></div>',
      '<div class="learning-topic-grid">',
      browseCards.map(topicCard).join(''),
      '</div>',
      '</div>',
      '</div>',
      '<div class="learning-hub__band learning-hub__band--tinted">',
      '<div class="page-width">',
      '<div class="learning-hub__section-heading learning-hub__section-heading--compact"><div><p class="learning-hub__eyebrow">Featured Learning</p><h2>' + escapeHtml(data.homepage.featuredHeading) + '</h2></div><p>Three pilot lessons for checking the Learning Hub reading experience.</p></div>',
      '<div class="learning-grid learning-grid--three">',
      popularLessons.map(function (lesson) {
        return lessonCard(lesson, true);
      }).join(''),
      '</div>',
      '</div>',
      '</div>',
      '<div class="learning-hub__band learning-hub__band--tinted">',
      '<div class="page-width learning-preview-bottom-cta">',
      '<h2>' + escapeHtml(data.homepage.bottomHeading) + '</h2>',
      '<p>' + escapeHtml(data.homepage.bottomCopy) + '</p>',
      '<div class="learning-hub__actions"><a class="button learning-cta" href="#preview-r08">' + escapeHtml(data.homepage.bottomPrimaryCta) + '</a><a class="button learning-cta" href="#learning-preview-topics">' + escapeHtml(data.homepage.bottomSecondaryCta) + '</a></div>',
      '</div>',
      '</div>',
      '</section>'
    ].join('');
  }

  function categoryPreview() {
    var category = categoryByHandle('gear-masks-vision');
    var lesson = lessonByHandle('choosing-a-mask');

    return [
      '<section id="preview-category-gear" class="learning-preview-page learning-category learning-category-preview">',
      '<div class="learning-category-hero"><div class="page-width"><nav class="learning-breadcrumbs" aria-label="Breadcrumbs"><a href="#preview-homepage">Learning Hub</a><span aria-hidden="true">/</span><span>' + escapeHtml(category.title) + '</span></nav><p class="learning-kicker">Learning Category</p><h1>' + escapeHtml(category.title) + '</h1><p class="learning-hub__lead">' + escapeHtml(category.short_description) + '</p></div></div>',
      '<div class="learning-category-list"><div class="page-width"><div class="learning-hub__section-heading learning-hub__section-heading--compact"><div><p class="learning-hub__eyebrow">Available Lessons</p><h2>Choose what to learn</h2></div></div><div class="learning-grid learning-grid--three">',
      lessonCard(lesson, true),
      '</div></div></div>',
      '</section>'
    ].join('');
  }

  function panel(title, items, extraClass) {
    if (!items || !items.length) {
      return '';
    }

    return [
      '<section class="learning-panel ' + (extraClass || '') + '">',
      '<h2>' + escapeHtml(title) + '</h2>',
      '<ul class="learning-takeaways">',
      items.map(function (item) {
        return '<li>' + escapeHtml(humanLessonText(item)) + '</li>';
      }).join(''),
      '</ul>',
      '</section>'
    ].join('');
  }

  // Safety Note is written as prose (not a bullet list) in every currently-
  // normalized lesson, so it needs its already-rendered markdown HTML
  // (safety_notes_html, built the same way as lesson_body_html) inserted
  // directly rather than forced through panel()'s bullet-only <ul> markup.
  function panelHtml(title, html, extraClass) {
    if (!html || !html.trim()) {
      return '';
    }

    return [
      '<section class="learning-panel ' + (extraClass || '') + '">',
      '<h2>' + escapeHtml(title) + '</h2>',
      humanLessonText(html),
      '</section>'
    ].join('');
  }

  function supportingContent(lesson) {
    var keyTakeaways = panel('Key Takeaways', lesson.key_takeaways, 'learning-panel--takeaways');
    var instructorTips = panel('Instructor Tips', lesson.instructor_tips, 'learning-panel--support');
    var commonMistakes = panel('Common Mistakes', lesson.common_mistakes, 'learning-panel--support');
    var safetyNote = panelHtml('Safety Note', lesson.safety_notes_html, 'learning-panel--safety');
    var supportGrid = instructorTips || commonMistakes ? [
      '<div class="learning-support-grid">',
      instructorTips,
      commonMistakes,
      '</div>'
    ].join('') : '';

    if (!keyTakeaways && !supportGrid && !safetyNote) {
      return '';
    }

    return [
      '<section class="learning-supporting" aria-label="Lesson recap and supporting notes">',
      keyTakeaways,
      supportGrid,
      safetyNote,
      '</section>'
    ].join('');
  }

  function downloadResources(lesson) {
    var resources = lesson.downloadable_resources || [];
    if (!resources.length) return '';

    var cards = resources.map(function (resource) {
      var href = resource.url || assetUrl(resource.asset_filename);
      if (!href) return '';
      return [
        '<div class="learning-download-card">',
        '<span><strong>' + escapeHtml(resource.label || 'Download resource') + '</strong>',
        '<small>Printable checklist for planning before you enter the water.</small></span>',
        '<a class="button learning-cta" href="' + escapeHtml(href) + '" download>Download Checklist</a>',
        '</div>'
      ].join('');
    }).filter(Boolean).join('');

    if (!cards) return '';

    return [
      '<section class="learning-panel learning-downloads">',
      '<p class="learning-hub__eyebrow">Take the Checklist With You</p>',
      '<h2>Downloads</h2>',
      '<div class="learning-download-list">',
      cards,
      '</div>',
      '</section>'
    ].join('');
  }

  function relatedLessonSection(lesson) {
    if (!lesson.related_lessons || !lesson.related_lessons.length) {
      return '';
    }

    var cards = lesson.related_lessons.map(function (related) {
      var availableLesson = related.handle ? lessonByHandle(related.handle) : null;
      var plannedLesson = !availableLesson && related.handle ? relatedLessonByHandle(related.handle) || related : null;
      var description = related.description ? '<p>' + escapeHtml(humanLessonText(related.description)) + '</p>' : '';
      var href = availableLesson
        ? '#preview-' + escapeHtml(availableLesson.lesson_id.toLowerCase())
        : plannedLesson
          ? relatedLessonAnchor(plannedLesson.handle)
          : '';
      var content = [
        '<h3>' + escapeHtml(humanLessonText(related.title)) + '</h3>',
        description,
        href ? '<span class="learning-card__footer">Read next →</span>' : '<span class="learning-card__footer">Planned lesson</span>'
      ].join('');

      if (href) {
        return [
          '<a class="learning-related-card" href="' + href + '">',
          content,
          '</a>'
        ].join('');
      }

      return [
        '<div class="learning-related-card learning-related-card--static">',
        content,
        '</div>'
      ].join('');
    }).join('');

    return [
      '<section class="learning-panel learning-related-lessons">',
      '<h2>Related Lessons / Next Step</h2>',
      '<div class="learning-related-grid">',
      cards,
      '</div>',
      '</section>'
    ].join('');
  }

  function plannedRelatedPreviews() {
    var seen = new Set(data.lessons.map(function (lesson) {
      return lesson.handle;
    }));
    var planned = [];

    data.lessons.forEach(function (lesson) {
      (lesson.related_lessons || []).forEach(function (related) {
        if (!related.handle || seen.has(related.handle)) return;
        var indexed = relatedLessonByHandle(related.handle) || related;
        planned.push({
          handle: related.handle,
          title: indexed.title || related.title,
          short_description: indexed.short_description || related.description || 'This Learning Hub lesson is planned for a future content phase.'
        });
        seen.add(related.handle);
      });
    });

    if (!planned.length) return '';

    return planned.map(function (lesson) {
      return [
        '<section id="preview-related-' + escapeHtml(lesson.handle) + '" class="learning-preview-page learning-lesson learning-lesson--planned">',
        '<div class="learning-hub__band learning-lesson-hero">',
        '<div class="page-width">',
        '<nav class="learning-breadcrumbs" aria-label="Breadcrumbs"><a href="#preview-homepage">Learning Hub</a><span aria-hidden="true">/</span><span>Planned Lesson</span></nav>',
        '<header><p class="learning-kicker">Planned Lesson</p><h1>' + escapeHtml(humanLessonText(lesson.title)) + '</h1><p class="learning-hub__lead">' + escapeHtml(humanLessonText(lesson.short_description)) + '</p></header>',
        '</div>',
        '</div>',
        '</section>'
      ].join('');
    }).join('');
  }

  function quizQuestions(lesson) {
    if (!lesson || !lesson.knowledge_check || !Array.isArray(lesson.knowledge_check.questions)) {
      return [];
    }

    return lesson.knowledge_check.questions;
  }

  function lessonBodyHtml(lesson) {
    var html = humanLessonText(lesson.lesson_body_html || '');

    if (!quizQuestions(lesson).length) {
      return html;
    }

    return html.replace(/\s*<h2>Knowledge Check<\/h2>[\s\S]*$/, '');
  }

  function knowledgeCheck(lesson) {
    if (!quizQuestions(lesson).length) {
      return '';
    }

    return [
      '<section class="learning-quiz" data-learning-quiz data-lesson-id="' + escapeHtml(lesson.lesson_id) + '">',
      '<p class="learning-hub__eyebrow">Knowledge Check</p>',
      '<h2>Check Your Understanding</h2>',
      '<form class="learning-quiz__form" data-quiz-form>',
      '<div class="learning-quiz__card" data-quiz-card>',
      '<div class="learning-quiz__stage" data-quiz-stage></div>',
      '<div class="learning-quiz__result" data-quiz-result role="status" aria-live="polite" tabindex="-1" hidden></div>',
      '</div>',
      '<div class="learning-hub__actions learning-quiz__actions">',
      '<button class="button learning-quiz__back" type="button" data-quiz-back hidden>Back</button>',
      '<button class="button learning-cta" type="button" data-quiz-primary disabled>Check Answer</button>',
      '<button class="button learning-cta" type="button" data-quiz-retry hidden>Try Again</button>',
      '</div>',
      '</form>',
      '</section>'
    ].join('');
  }

  function lessonPreview(lesson) {
    var category = categoryByHandle(lesson.category);

    return [
      '<article id="preview-' + escapeHtml(lesson.lesson_id.toLowerCase()) + '" class="learning-preview-page learning-lesson">',
      '<div class="learning-hub__band learning-lesson-hero">',
      '<div class="page-width">',
      '<div class="learning-hero-inner">',
      '<nav class="learning-breadcrumbs" aria-label="Breadcrumbs"><a href="#preview-homepage">Learning Hub</a><span aria-hidden="true">/</span><a href="#preview-category-gear">' + escapeHtml(category.title) + '</a></nav>',
      '<header><p class="learning-kicker">' + escapeHtml(lesson.lesson_type) + '</p><h1>' + escapeHtml(lesson.title) + '</h1><p class="learning-hub__lead">' + escapeHtml(lesson.short_description) + '</p><div class="learning-meta"><span class="learning-meta__item">' + escapeHtml(category.title) + '</span><span class="learning-meta__item">' + escapeHtml(lesson.estimated_reading_time) + '</span></div></header>',
      '</div>',
      '</div>',
      '</div>',
      '<div class="learning-hub__band learning-lesson-body-band">',
      '<div class="page-width learning-lesson-flow">',
      '<div class="learning-article"><div class="learning-rich-text">' + lessonBodyHtml(lesson) + '</div></div>',
      downloadResources(lesson),
      supportingContent(lesson),
      knowledgeCheck(lesson),
      relatedLessonSection(lesson),
      '</div>',
      '</div>',
      '</article>'
    ].join('');
  }

  function initKnowledgeChecks() {
    var quizzes = root.querySelectorAll('[data-learning-quiz]');

    Array.prototype.forEach.call(quizzes, function (quiz) {
      var lesson = data.lessons.find(function (item) {
        return item.lesson_id === quiz.getAttribute('data-lesson-id');
      });
      var questions = quizQuestions(lesson);
      var form = quiz.querySelector('[data-quiz-form]');
      var card = quiz.querySelector('[data-quiz-card]');
      var stage = quiz.querySelector('[data-quiz-stage]');
      var result = quiz.querySelector('[data-quiz-result]');
      var primaryButton = quiz.querySelector('[data-quiz-primary]');
      var backButton = quiz.querySelector('[data-quiz-back]');
      var retryButton = quiz.querySelector('[data-quiz-retry]');
      var questionIndex = 0;
      var questionStates = questions.map(function () {
        return {
          selectedIndex: -1,
          checked: false,
          isCorrect: false
        };
      });

      function answerLetter(index) {
        return String.fromCharCode(65 + index);
      }

      function focusCurrentQuestion() {
        var question = quiz.querySelector('[data-quiz-question]');

        if (question) {
          question.focus({ preventScroll: true });
        }
      }

      function renderQuestion(shouldFocus) {
        var question = questions[questionIndex];
        var state = questionStates[questionIndex];
        var name = 'learning-quiz-' + lesson.lesson_id.toLowerCase() + '-' + questionIndex;

        card.classList.remove('is-correct', 'is-incorrect');
        result.hidden = true;
        result.className = 'learning-quiz__result';
        result.innerHTML = '';
        primaryButton.hidden = false;
        primaryButton.disabled = !state.checked && state.selectedIndex < 0;
        primaryButton.textContent = state.checked
          ? questionIndex + 1 === questions.length ? 'Finish Quiz' : 'Next Question'
          : 'Check Answer';
        backButton.hidden = questionIndex === 0;
        retryButton.hidden = true;

        stage.innerHTML = [
          '<p class="learning-quiz__progress">Question ' + (questionIndex + 1) + ' of ' + questions.length + '</p>',
          '<fieldset class="learning-quiz__fieldset">',
          '<legend class="learning-quiz__question" data-quiz-question tabindex="-1">' + escapeHtml(question.question) + '</legend>',
          '<div class="learning-quiz__answers">',
          question.answers.map(function (answer, index) {
            var id = name + '-' + index;

            return [
              '<label class="learning-quiz__answer" data-quiz-answer>',
              '<input type="radio" name="' + escapeHtml(name) + '" id="' + escapeHtml(id) + '" value="' + index + '"' + (state.selectedIndex === index ? ' checked' : '') + (state.checked ? ' disabled' : '') + '>',
              '<span class="learning-quiz__answer-content">',
              '<span class="learning-quiz__letter" aria-hidden="true">' + answerLetter(index) + '</span>',
              '<span>' + escapeHtml(answer) + '</span>',
              '</span>',
              '</label>'
            ].join('');
          }).join(''),
          '</div>',
          '</fieldset>'
        ].join('');

        if (state.checked) {
          card.classList.add(state.isCorrect ? 'is-correct' : 'is-incorrect');
          var answers = quiz.querySelectorAll('[data-quiz-answer]');

          Array.prototype.forEach.call(answers, function (answer, index) {
            if (index === question.correct_index) {
              answer.classList.add('is-correct');
            }

            if (index === state.selectedIndex && !state.isCorrect) {
              answer.classList.add('is-incorrect');
            }
          });

          result.hidden = false;
          result.className = 'learning-quiz__result learning-quiz__result--' + (state.isCorrect ? 'correct' : 'incorrect');
          result.innerHTML = state.isCorrect
            ? '<strong>Correct</strong><span>' + escapeHtml(question.explanation) + '</span>'
            : '<strong>Not quite</strong><span>Correct answer: ' + answerLetter(question.correct_index) + '. ' + escapeHtml(question.answers[question.correct_index]) + '</span><span>' + escapeHtml(question.explanation) + '</span>';
        }

        if (shouldFocus) {
          focusCurrentQuestion();
        }
      }

      function renderScore() {
        var score = questionStates.reduce(function (total, state) {
          return total + (state.checked && state.isCorrect ? 1 : 0);
        }, 0);

        card.classList.remove('is-correct', 'is-incorrect');
        stage.innerHTML = [
          '<div class="learning-quiz__score" tabindex="-1" data-quiz-question>',
          '<p class="learning-quiz__progress">Your Score</p>',
          '<h3>' + score + ' / ' + questions.length + '</h3>',
          '<p>Nice work. You have finished this knowledge check and can keep reading or try it again.</p>',
          '</div>'
        ].join('');
        result.hidden = true;
        primaryButton.hidden = true;
        backButton.hidden = true;
        retryButton.hidden = false;
        focusCurrentQuestion();
      }

      form.addEventListener('change', function (event) {
        if (event.target && event.target.type === 'radio') {
          questionStates[questionIndex].selectedIndex = Number(event.target.value);
          primaryButton.disabled = false;
        }
      });

      primaryButton.addEventListener('click', function () {
        var question = questions[questionIndex];
        var state = questionStates[questionIndex];

        if (state.checked) {
          questionIndex += 1;

          if (questionIndex >= questions.length) {
            renderScore();
            return;
          }

          renderQuestion(true);
          return;
        }

        if (state.selectedIndex < 0) return;

        state.checked = true;
        state.isCorrect = state.selectedIndex === question.correct_index;
        renderQuestion(false);
        result.focus({ preventScroll: true });
      });

      backButton.addEventListener('click', function () {
        questionIndex = Math.max(0, questionIndex - 1);
        renderQuestion(true);
      });

      retryButton.addEventListener('click', function () {
        questionIndex = 0;
        questionStates = questions.map(function () {
          return {
            selectedIndex: -1,
            checked: false,
            isCorrect: false
          };
        });
        renderQuestion(true);
      });

      renderQuestion(false);
    });
  }

  root.innerHTML = [
    previewNav(),
    '<div class="learning-hub learning-preview color-scheme-1">',
    homepage(),
    categoryPreview(),
    data.lessons.map(lessonPreview).join(''),
    plannedRelatedPreviews(),
    '</div>'
  ].join('');

  initKnowledgeChecks();
  resolveAssetReferences(root);

  // Baked lesson_body_html omits the autoplay attribute so this preview
  // matches the live Liquid path's behavior (learning-hub-inline-media.js):
  // only autoplay muted/looping demo videos when motion is not reduced.
  (function initVideoAutoplay() {
    var prefersReducedMotion = typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      return;
    }

    Array.prototype.forEach.call(root.querySelectorAll('video[muted][loop]'), function (video) {
      video.autoplay = true;
      video.play && video.play().catch(function () {});
    });
  }());

  var previewJump = root.querySelector('[data-preview-jump]');
  if (previewJump) {
    previewJump.addEventListener('change', function () {
      if (previewJump.value) {
        window.location.hash = previewJump.value;
        previewJump.value = '';
      }
    });
  }
}());
