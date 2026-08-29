# Quiz Architecture

## Recommendation

Do not create quiz metaobjects for launch. Keep knowledge checks inside the lesson content in Git and render them as part of `learning_lesson.lesson_body`.

This preserves the editorial intent of the pilot lessons without adding an interactive assessment system before the core Learning Hub pages are proven.

## Official Shopify Docs Checked

- Metaobject definitions: https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions
- Metafield/metaobject data types: https://shopify.dev/docs/apps/build/metafields/list-of-data-types
- Metaobject limits: https://shopify.dev/docs/apps/build/metaobjects/metaobject-limits
- Storefront API metaobject object: https://shopify.dev/docs/api/storefront/latest/objects/metaobject

Relevant findings:

- Metaobjects are a good fit for reusable content entities, but every extra quiz/question definition adds relationship and import complexity.
- Metaobject definitions currently have field-count limits.
- Shopify metaobjects can render content, but they are not by themselves a learning progress, scoring, or learner-record system.

## Launch Model

Launch knowledge checks as editorial content:

- Store the source structure in Markdown.
- Import public question text and answers into `lesson_body` only when they are meant to be visible.
- Avoid storing answer keys in public Shopify fields if the quiz is intended to test knowledge.
- Treat knowledge checks as lightweight self-checks, not assessments.

Theme rendering can use simple headings and callout styling in the lesson body. If the Markdown parser later supports custom markers, it can render a more distinct "Knowledge check" block without changing the Shopify data model.

## What Not to Build Now

Do not create these launch definitions:

- `learning_quiz`
- `learning_quiz_question`
- `learning_quiz_answer`
- `learning_progress`
- `learning_certificate`

Reasons:

- The approved Stage 3 work focused on lesson schema and editorial quality, not a scored learning product.
- Progress tracking introduces privacy, account, analytics, and data-retention decisions.
- The first implementation risk is reliable content rendering, not quiz scoring.
- Quiz definitions can be added later without changing the public lesson URLs.

## Future Quiz Model

Add a structured quiz model only when the business requirement is clear:

- interactive grading
- saved learner progress
- reward or certificate logic
- segmentation by logged-in customer
- reporting in Admin or an external system

Possible future definitions:

### `learning_quiz`

Fields:

- `title`
- `short_description`
- `lesson` as `metaobject_reference<learning_lesson>`
- `questions` as `list.metaobject_reference<learning_quiz_question>`
- `pass_threshold`
- `quiz_status`

### `learning_quiz_question`

Fields:

- `question_text`
- `question_type`
- `answer_options` as `json`
- `correct_answer` as `json`
- `explanation`
- `sort_order`

This model should not be implemented until there is a decision about whether correct answers may be exposed to the storefront.

## Progress Tracking

Do not store learner progress in public metaobjects.

Future progress options should be evaluated separately:

- Shopify Customer Account extension or custom app storage
- customer metafields after access and privacy review
- an external learning platform or analytics service
- anonymous local progress for non-sensitive "visited/completed" UI only

Any saved progress plan needs consent, retention, deletion, and reporting rules before implementation.

## Migration Path

To keep the launch content quiz-ready:

1. Preserve knowledge-check structure in the Markdown source.
2. Use consistent headings such as `Knowledge Check`.
3. Keep answer/explanation content clearly marked in Git.
4. Avoid burying quiz material inside screenshots or images.
5. Add a parser later that converts Markdown knowledge checks into quiz/question metaobjects.

This gives the current content a clean path into structured quizzes without forcing that system into the first Shopify build.

