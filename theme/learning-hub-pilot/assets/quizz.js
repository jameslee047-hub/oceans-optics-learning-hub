document.addEventListener('DOMContentLoaded', function() {
    const quizData = [
        {
            question: "What is the largest ocean on Earth?",
            a: "Atlantic Ocean",
            b: "Indian Ocean",
            c: "Pacific Ocean",
            d: "Arctic Ocean",
            correct: "c"
        },
        {
            question: "What is the deepest part of the world's oceans?",
            a: "Mariana Trench",
            b: "Java Trench",
            c: "Puerto Rico Trench",
            d: "Tonga Trench",
            correct: "a"
        },
        {
            question: "What percentage of the Earth's surface is covered by oceans?",
            a: "50%",
            b: "60%",
            c: "70%",
            d: "80%",
            correct: "c"
        },
        {
            question: "Which ocean is the smallest?",
            a: "Indian Ocean",
            b: "Southern Ocean",
            c: "Atlantic Ocean",
            d: "Arctic Ocean",
            correct: "d"
        },
        {
            question: "What is the most abundant gas in the ocean?",
            a: "Oxygen",
            b: "Hydrogen",
            c: "Carbon Dioxide",
            d: "Nitrogen",
            correct: "d"
        }
    ];

    let currentQuestionIndex = 0;
    let userAnswers = [];

    function showQuestion(index) {
        const currentQuestion = quizData[index];
        const output = [];

        const answers = [];
        for (let letter in currentQuestion) {
            if (letter !== 'question' && letter !== 'correct') {
                answers.push(
                    `<label>
                        <input type="radio" name="question${index}" value="${letter}">
                        ${letter} :
                        ${currentQuestion[letter]}
                    </label>`
                );
            }
        }

        output.push(
            `<div class="question">${currentQuestion.question}</div>
            <div class="answers">${answers.join('')}</div>`
        );

        document.getElementById('quizz').innerHTML = output.join('');
        console.log('Showing question:', currentQuestion.question);
    }

    function showResults() {
        const resultsContainer = document.getElementById('results');
        resultsContainer.innerHTML = '';
        quizData.forEach((currentQuestion, questionNumber) => {
            const userAnswer = userAnswers[questionNumber];
            const correctAnswer = currentQuestion.correct;
            const isCorrect = userAnswer === correctAnswer;

            const questionResult = document.createElement('div');
            questionResult.className = 'question-result';
            questionResult.innerHTML = `
                <div class="question">${currentQuestion.question}</div>
                <div class="answer">${isCorrect ? 'Correct' : 'Incorrect'}</div>
                ${!isCorrect ? `<div class="correct-answer">Correct answer: ${correctAnswer.toUpperCase()}</div>` : ''}
            `;

            resultsContainer.appendChild(questionResult);
        });

        document.getElementById('retry').style.display = 'block';
        console.log('Showing results');
    }

    function nextQuestion() {
        console.log('Next question button clicked');
        const answerContainers = document.querySelectorAll('.answers');
        const selector = `input[name=question${currentQuestionIndex}]:checked`;
        const userAnswer = (answerContainers[0].querySelector(selector) || {}).value;
        userAnswers[currentQuestionIndex] = userAnswer;

        console.log('User answer:', userAnswer);

        currentQuestionIndex++;

        if (currentQuestionIndex < quizData.length) {
            showQuestion(currentQuestionIndex);
        } else {
            document.getElementById('quizz').style.display = 'none';
            document.getElementById('submit').style.display = 'none';
            showResults();
        }
    }

    function retryQuiz() {
        console.log('Retry quizz button clicked');
        currentQuestionIndex = 0;
        userAnswers = [];
        document.getElementById('quizz').style.display = 'block';
        document.getElementById('submit').style.display = 'block';
        document.getElementById('results').innerHTML = '';
        document.getElementById('retry').style.display = 'none';
        showQuestion(currentQuestionIndex);
    }

    document.getElementById('submit').addEventListener('click', nextQuestion);
    document.getElementById('retry').addEventListener('click', retryQuiz);

    showQuestion(currentQuestionIndex);
});
