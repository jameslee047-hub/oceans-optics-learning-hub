// Production Knowledge Check widget.
//
// Renders the interactive "select an answer, then reveal correct/incorrect
// and the explanation" quiz used on live lesson pages. This is the same
// interaction model already proven in learning-hub-preview.js's
// initKnowledgeChecks() (radio-button answers inside a <fieldset>, native
// form semantics, focus management, an aria-live result region) -- adapted
// here to read from the small generated production data file
// (learning-hub-knowledge-check-data.js) instead of the full dev-preview
// fixture, and keyed by the lesson's public handle rather than its internal
// lesson_id, since only the handle is meant to reach a learner.
//
// No account/login is involved anywhere in this file. Nothing here stores a
// score or reads/writes any persistent state -- each page load starts fresh.
// It does dispatch two DOM CustomEvents (see EVENT_QUESTION_ANSWERED and
// EVENT_QUIZ_COMPLETED below) so a future progress feature can listen for
// them without any change to this UI.
(function () {
  var EVENT_QUESTION_ANSWERED = 'oo:knowledge-check-question-answered';
  var EVENT_QUIZ_COMPLETED = 'oo:knowledge-check-completed';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function answerLetter(index) {
    return String.fromCharCode(65 + index);
  }

  function initQuiz(quiz, questions) {
    var handle = quiz.getAttribute('data-lesson-handle') || '';
    var form = quiz.querySelector('[data-quiz-form]');
    var card = quiz.querySelector('[data-quiz-card]');
    var stage = quiz.querySelector('[data-quiz-stage]');
    var result = quiz.querySelector('[data-quiz-result]');
    var primaryButton = quiz.querySelector('[data-quiz-primary]');
    var backButton = quiz.querySelector('[data-quiz-back]');
    var retryButton = quiz.querySelector('[data-quiz-retry]');
    if (!form || !card || !stage || !result || !primaryButton || !backButton || !retryButton) return;

    var questionIndex = 0;
    var questionStates = questions.map(function () {
      return { selectedIndex: -1, checked: false, isCorrect: false };
    });

    function focusCurrentQuestion() {
      var question = quiz.querySelector('[data-quiz-question]');
      if (question) question.focus({ preventScroll: true });
    }

    function dispatch(name, detail) {
      quiz.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail }));
    }

    function renderQuestion(shouldFocus) {
      var question = questions[questionIndex];
      var state = questionStates[questionIndex];
      var name = 'learning-quiz-' + handle + '-' + questionIndex;

      card.classList.remove('is-correct', 'is-incorrect');
      result.hidden = true;
      result.className = 'learning-quiz__result';
      result.innerHTML = '';
      primaryButton.hidden = false;
      primaryButton.disabled = !state.checked && state.selectedIndex < 0;
      primaryButton.textContent = state.checked
        ? (questionIndex + 1 === questions.length ? 'Finish Quiz' : 'Next Question')
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
            '<input type="radio" name="' + escapeHtml(name) + '" id="' + escapeHtml(id) + '" value="' + index + '"' +
              (state.selectedIndex === index ? ' checked' : '') + (state.checked ? ' disabled' : '') + '>',
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
          if (index === question.correct_index) answer.classList.add('is-correct');
          if (index === state.selectedIndex && !state.isCorrect) answer.classList.add('is-incorrect');
        });

        result.hidden = false;
        result.className = 'learning-quiz__result learning-quiz__result--' + (state.isCorrect ? 'correct' : 'incorrect');
        result.innerHTML = state.isCorrect
          ? '<strong>Correct</strong><span>' + escapeHtml(question.explanation) + '</span>'
          : '<strong>Not quite</strong><span>Correct answer: ' + answerLetter(question.correct_index) + '. ' +
            escapeHtml(question.answers[question.correct_index]) + '</span><span>' + escapeHtml(question.explanation) + '</span>';
      }

      if (shouldFocus) focusCurrentQuestion();
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

      dispatch(EVENT_QUIZ_COMPLETED, {
        lessonHandle: handle,
        score: score,
        total: questions.length
      });
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

      dispatch(EVENT_QUESTION_ANSWERED, {
        lessonHandle: handle,
        questionIndex: questionIndex,
        selectedIndex: state.selectedIndex,
        isCorrect: state.isCorrect
      });
    });

    backButton.addEventListener('click', function () {
      questionIndex = Math.max(0, questionIndex - 1);
      renderQuestion(true);
    });

    retryButton.addEventListener('click', function () {
      questionIndex = 0;
      questionStates = questions.map(function () {
        return { selectedIndex: -1, checked: false, isCorrect: false };
      });
      renderQuestion(true);
    });

    renderQuestion(false);
  }

  function addQuizJumpButton(quiz) {
    var article = quiz.closest('.learning-lesson');
    var meta = article && article.querySelector('.learning-meta');
    if (!meta || meta.querySelector('[data-quiz-jump]')) return;

    var titleEl = article.querySelector('h1');
    var title = titleEl ? titleEl.textContent.trim() : '';
    var anchor = quiz.id ? '#' + quiz.id : '#knowledge-check';

    var link = document.createElement('a');
    link.className = 'button learning-cta learning-quiz-jump';
    link.href = anchor;
    link.setAttribute('data-quiz-jump', '');
    link.setAttribute('aria-label', title ? 'Take ' + title + ' Quiz' : 'Take Quiz');
    link.textContent = 'Take Quiz';
    link.addEventListener('click', function (event) {
      event.preventDefault();
      quiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    meta.appendChild(link);
  }

  function init() {
    var data = window.OOLearningHubKnowledgeCheckData || {};
    var quizzes = document.querySelectorAll('[data-learning-quiz]');

    Array.prototype.forEach.call(quizzes, function (quiz) {
      var handle = quiz.getAttribute('data-lesson-handle') || '';
      var entry = data[handle];
      var questions = entry && Array.isArray(entry.questions) ? entry.questions : [];

      // No Knowledge Check for this lesson: remove the empty shell rather
      // than show a heading with nothing under it.
      if (!questions.length) {
        quiz.remove();
        return;
      }

      addQuizJumpButton(quiz);
      initQuiz(quiz, questions);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
