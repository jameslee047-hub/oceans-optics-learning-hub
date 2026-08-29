# Knowledge Check Schema Proposal

This is a documentation-only proposal. Do not change Shopify metaobject definitions during Stage 6.

## Recommendation

Add a future production field:

- Metaobject definition: `learning_lesson`
- Field key: `knowledge_check`
- Type: `json`
- Public purpose: render lightweight lesson retention checks on the web and printable answer keys in PDF/print outputs.

## Proposed JSON Structure

```json
{
  "questions": [
    {
      "question": "If a snorkeler may need vision correction underwater, what should they consider early?",
      "answers": [
        "Skirt color only",
        "Prescription compatibility and lens format",
        "Whether the mask is easiest to share"
      ],
      "correct_index": 1,
      "explanation": "Prescription needs should shape the shortlist before the final mask choice."
    }
  ]
}
```

## Validation Options

- Require `questions` as an array.
- Require at least one question when the field is present.
- Require each question to include `question`, `answers`, `correct_index`, and `explanation`.
- Require `answers` to contain at least two options; the current pilot uses three.
- Require `correct_index` to be an integer within the answers array.
- Keep answer order intentional and editorially reviewed.
- Keep safety/current-guidance lesson quizzes blocked until the lesson itself has the required named reviewer.

## Theme Rendering Approach

The theme can branch by output context:

- If `knowledge_check` exists and JavaScript is available, render an interactive web component.
- If JavaScript is unavailable, render a plain printable fallback from the same structured JSON.
- Do not parse quiz questions out of rich-text lesson prose in production.

## Markdown Source Of Truth Representation

For now, pilot lesson Markdown remains the lesson-copy source of truth and keeps the existing structured Knowledge Check Markdown format.

When the production JSON field is approved, the Markdown source can add a clearly structured block such as:

```markdown
## Knowledge Check

Question:
If a snorkeler may need vision correction underwater, what should they consider early?

Answers:
- Skirt color only
- Prescription compatibility and lens format
- Whether the mask is easiest to share

Correct index: 1

Explanation:
Prescription needs should shape the shortlist before the final mask choice.
```

The exact Markdown representation should be chosen when the import/sync workflow is updated.

## Web Rendering

For web output:

- Show one question at a time.
- Display `Question X of Y`.
- Use radio buttons or accessible buttons for answer choices.
- Enable `Check Answer` only after a selection.
- After checking, show `Correct` or `Not quite` plus the explanation.
- Move to the next question.
- At the end, show `Your Score` and an optional `Try Again`.
- Keep state browser-local for the current page session only.

## PDF / Print Rendering

For PDF or print output:

- Render question text and answer choices.
- Render an answer/explanation section from the same JSON.
- Do not include interactive controls.
- Do not require account tracking, saved scores, or any backend state.

## Migration Of R01, R08, And R12

The Stage 6 development preview now uses structured fixture data matching this proposed shape for:

- `R01 Choosing a Mask`
- `R08 Golden Rules for Safer Snorkeling`
- `R12 Currents & Rip Currents`

When Shopify schema changes are approved later, migrate the existing approved questions into `learning_lesson.knowledge_check` without rewriting the question wording.
