(function () {
  var data = window.OOLearningHubPreviewData;
  var root = document.getElementById('LearningHubPreviewRoot');

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

  function previewNav() {
    return [
      '<nav class="learning-preview-nav page-width" aria-label="Learning Hub preview navigation">',
      '<a href="#preview-homepage">Homepage</a>',
      '<a href="#preview-category-gear">Gear Category</a>',
      '<a href="#preview-r01">' + escapeHtml(lessonTitleByHandle('choosing-a-mask', 'Choosing a Mask')) + '</a>',
      '<a href="#preview-r08">' + escapeHtml(lessonTitleByHandle('golden-rules-for-safer-snorkeling', 'Golden Rules for Safer Snorkeling')) + '</a>',
      '<a href="#preview-r12">' + escapeHtml(lessonTitleByHandle('currents-and-rip-currents', 'Currents & Rip Currents')) + '</a>',
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
      '<span class="learning-sequence-card__subtitle">' + escapeHtml(display.subtitle) + '</span>',
      '<span class="learning-sequence-card__cue" aria-hidden="true">→</span>',
      '</a>'
    ].join('');
  }

  function topicCard(item, index) {
    var number = String(index + 1).padStart(2, '0');
    var label = item.handle === 'start-here' ? '<span class="learning-topic-card__label">Beginner Pathway</span>' : '';
    var action = item.handle === 'start-here' ? 'Start here' : 'Explore topic';
    var url = item.handle === 'gear-masks-vision' ? '#preview-category-gear' : '#preview-homepage';
    var extraClass = item.handle === 'start-here' ? ' learning-topic-card--pathway' : '';

    return [
      '<article class="learning-topic-card' + extraClass + '" data-topic-card>',
      '<span class="learning-topic-card__number" aria-hidden="true">' + number + '</span>',
      label,
      '<span class="learning-topic-card__title">' + escapeHtml(item.title) + '</span>',
      '<p class="learning-topic-card__description">' + escapeHtml(item.short_description) + '</p>',
      '<a class="learning-topic-card__cta" href="' + escapeHtml(url) + '">' + escapeHtml(action) + '</a>',
      '</article>'
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
      '<a class="button" href="#preview-r08">' + escapeHtml(data.homepage.primaryCta) + '</a>',
      '<a class="button button--secondary" href="#learning-preview-topics">' + escapeHtml(data.homepage.secondaryCta) + '</a>',
      '</div>',
      '</div>',
      '</div>',
      '<div class="learning-hub__band learning-hub__band--tinted">',
      '<div class="page-width">',
      '<div class="learning-hub__section-heading learning-hub__section-heading--compact"><div><p class="learning-hub__eyebrow">Start Here</p><h2>' + escapeHtml(data.homepage.startHeading) + '</h2></div><p>' + escapeHtml(data.homepage.startCopy[0]) + '</p></div>',
      '<div class="learning-sequence-grid" aria-label="Start Here beginner pathway">',
      data.startHere.map(startStepCard).join(''),
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
      '<div class="learning-hub__band">',
      '<div class="page-width learning-knowledge">',
      '<div class="learning-knowledge__visual" role="note">Development visual placeholder</div>',
      '<div class="learning-knowledge__copy">',
      '<p class="learning-hub__eyebrow">Why Learn With Oceans Optics</p>',
      '<h2>' + escapeHtml(data.homepage.whyHeading) + '</h2>',
      paragraphs(data.homepage.whyCopy),
      '<ul class="learning-knowledge__points">',
      '<li>Gear choices explained in plain language</li>',
      '<li>Snorkeling and scuba instructor perspective</li>',
      '<li>Clear next lessons instead of overloaded pages</li>',
      '</ul>',
      '</div>',
      '</div>',
      '</div>',
      '<div class="learning-hub__band learning-hub__band--tinted">',
      '<div class="page-width learning-preview-bottom-cta">',
      '<h2>' + escapeHtml(data.homepage.bottomHeading) + '</h2>',
      '<p>' + escapeHtml(data.homepage.bottomCopy) + '</p>',
      '<div class="learning-hub__actions"><a class="button" href="#preview-r08">' + escapeHtml(data.homepage.bottomPrimaryCta) + '</a><a class="button button--secondary" href="#learning-preview-topics">' + escapeHtml(data.homepage.bottomSecondaryCta) + '</a></div>',
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

  function supportingContent(lesson) {
    var keyTakeaways = panel('Key Takeaways', lesson.key_takeaways, 'learning-panel--takeaways');
    var instructorTips = panel('Instructor Tips', lesson.instructor_tips, 'learning-panel--support');
    var commonMistakes = panel('Common Mistakes', lesson.common_mistakes, 'learning-panel--support');
    var safetyNote = panel('Safety Note', lesson.safety_notes, 'learning-panel--safety');
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
      '<div class="learning-quiz__stage" data-quiz-stage></div>',
      '<div class="learning-quiz__result" data-quiz-result role="status" aria-live="polite" tabindex="-1" hidden></div>',
      '<div class="learning-hub__actions learning-quiz__actions">',
      '<button class="button" type="button" data-quiz-check disabled>Check Answer</button>',
      '<button class="button button--secondary" type="button" data-quiz-next hidden>Next Question</button>',
      '<button class="button button--secondary" type="button" data-quiz-retry hidden>Try Again</button>',
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
      '<nav class="learning-breadcrumbs" aria-label="Breadcrumbs"><a href="#preview-homepage">Learning Hub</a><span aria-hidden="true">/</span><a href="#preview-category-gear">' + escapeHtml(category.title) + '</a></nav>',
      '<header><p class="learning-kicker">' + escapeHtml(lesson.lesson_type) + '</p><h1>' + escapeHtml(lesson.title) + '</h1><p class="learning-hub__lead">' + escapeHtml(lesson.short_description) + '</p><div class="learning-meta"><span class="learning-meta__item">' + escapeHtml(category.title) + '</span><span class="learning-meta__item">' + escapeHtml(lesson.estimated_reading_time) + '</span></div></header>',
      '</div>',
      '</div>',
      '<div class="learning-hub__band learning-lesson-body-band">',
      '<div class="page-width learning-lesson-flow">',
      '<div class="learning-article"><div class="learning-rich-text">' + lessonBodyHtml(lesson) + '</div></div>',
      supportingContent(lesson),
      knowledgeCheck(lesson),
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
      var stage = quiz.querySelector('[data-quiz-stage]');
      var result = quiz.querySelector('[data-quiz-result]');
      var checkButton = quiz.querySelector('[data-quiz-check]');
      var nextButton = quiz.querySelector('[data-quiz-next]');
      var retryButton = quiz.querySelector('[data-quiz-retry]');
      var questionIndex = 0;
      var score = 0;
      var selectedIndex = -1;

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
        var name = 'learning-quiz-' + lesson.lesson_id.toLowerCase() + '-' + questionIndex;

        selectedIndex = -1;
        result.hidden = true;
        result.className = 'learning-quiz__result';
        result.innerHTML = '';
        checkButton.hidden = false;
        checkButton.disabled = true;
        nextButton.hidden = true;
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
              '<input type="radio" name="' + escapeHtml(name) + '" id="' + escapeHtml(id) + '" value="' + index + '">',
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

        if (shouldFocus) {
          focusCurrentQuestion();
        }
      }

      function renderScore() {
        stage.innerHTML = [
          '<div class="learning-quiz__score" tabindex="-1" data-quiz-question>',
          '<p class="learning-quiz__progress">Your Score</p>',
          '<h3>' + score + ' / ' + questions.length + '</h3>',
          '<p>Nice work. You have finished this knowledge check and can keep reading or try it again.</p>',
          '</div>'
        ].join('');
        result.hidden = true;
        checkButton.hidden = true;
        nextButton.hidden = true;
        retryButton.hidden = false;
        focusCurrentQuestion();
      }

      form.addEventListener('change', function (event) {
        if (event.target && event.target.type === 'radio') {
          selectedIndex = Number(event.target.value);
          checkButton.disabled = false;
        }
      });

      checkButton.addEventListener('click', function () {
        var question = questions[questionIndex];
        var isCorrect = selectedIndex === question.correct_index;
        var answers = quiz.querySelectorAll('[data-quiz-answer]');

        if (selectedIndex < 0) {
          return;
        }

        if (isCorrect) {
          score += 1;
        }

        Array.prototype.forEach.call(answers, function (answer, index) {
          var input = answer.querySelector('input');

          if (index === question.correct_index) {
            answer.classList.add('is-correct');
          }

          if (index === selectedIndex && !isCorrect) {
            answer.classList.add('is-incorrect');
          }

          if (input) {
            input.disabled = true;
          }
        });

        result.hidden = false;
        result.className = 'learning-quiz__result learning-quiz__result--' + (isCorrect ? 'correct' : 'incorrect');
        result.innerHTML = isCorrect
          ? '<strong>Correct</strong><span>' + escapeHtml(question.explanation) + '</span>'
          : '<strong>Not quite</strong><span>Correct answer: ' + answerLetter(question.correct_index) + '. ' + escapeHtml(question.answers[question.correct_index]) + '</span><span>' + escapeHtml(question.explanation) + '</span>';
        checkButton.hidden = true;
        nextButton.hidden = false;
        nextButton.textContent = questionIndex + 1 === questions.length ? 'See Score' : 'Next Question';
        result.focus({ preventScroll: true });
      });

      nextButton.addEventListener('click', function () {
        questionIndex += 1;

        if (questionIndex >= questions.length) {
          renderScore();
          return;
        }

        renderQuestion(true);
      });

      retryButton.addEventListener('click', function () {
        questionIndex = 0;
        score = 0;
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
    lessonPreview(lessonByHandle('choosing-a-mask')),
    lessonPreview(lessonByHandle('golden-rules-for-safer-snorkeling')),
    lessonPreview(lessonByHandle('currents-and-rip-currents')),
    '</div>'
  ].join('');

  initKnowledgeChecks();
}());
