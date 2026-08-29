import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, loadCategories, loadLessons } from "./lib/learning-data.js";

const OUTPUT_PATH = path.join(REPO_ROOT, "theme/learning-hub-pilot/assets/learning-hub-preview-data.js");

// Homepage/"Start Here" marketing copy has no canonical public-copy.md source.
// It lives here (the single hand-authored place) instead of in the generated
// fixture, so the generated file never needs manual edits.
const HOMEPAGE = {
  heading: "Learn to Snorkel with Confidence",
  intro: [
    "Practical snorkeling knowledge to help you choose the right gear, understand the water, improve your skills, and get more from every time you enter the ocean.",
    "Built from real-world snorkeling and scuba experience, the Oceans Optics Learning Hub breaks the essentials down into simple, bite-sized lessons you can learn at your own pace."
  ],
  primaryCta: "Start Learning",
  secondaryCta: "Browse All Topics",
  startHeading: "New to Snorkeling? Start Here",
  startCopy: [
    "You don't need to learn everything at once. Start with the essentials: getting ready, choosing the right mask, understanding basic safety, planning your snorkel, and knowing what to expect when you enter the water.",
    "Follow our beginner pathway and build your confidence one lesson at a time."
  ],
  startCta: "Start Here",
  featuredHeading: "Popular Lessons",
  whyHeading: "Knowledge Beyond the Gear",
  whyCopy: [
    "Oceans Optics was built by snorkelers and scuba instructors, so we know that the right equipment is only part of having a great experience underwater.",
    "Our goal is to help you understand why things work, not simply tell you what to buy.",
    "From finding a mask that fits properly to understanding underwater vision, currents, equalizing, and basic snorkeling skills, we want to make reliable knowledge easier to access before you enter the water.",
    "And when something needs more explanation, we'll point you toward the next lesson rather than trying to cram everything onto one page."
  ],
  bottomHeading: "Ready to Explore?",
  bottomCopy: "Start with the basics, jump into a subject that interests you, or come back whenever you need a refresher.",
  bottomPrimaryCta: "Start Here",
  bottomSecondaryCta: "Browse All Lessons"
};

const START_HERE = [
  {
    lesson_id: "R07",
    title: "Health, Readiness and Personal Responsibility",
    description: "Start with honest self-checks, comfort, fitness, and personal responsibility before entering the water."
  },
  {
    lesson_id: "R08",
    title: "Golden Rules for Safer Snorkeling",
    description: "A concise briefing on buddy habits, conditions, limits, signals, and calm decision-making."
  },
  {
    lesson_id: "R01",
    title: "Choosing a Mask",
    description: "Compare lens format, skirt color, and underwater vision needs before moving into detailed fit checks."
  },
  {
    lesson_id: "R10",
    title: "Pre-Snorkel Checklist and Planning",
    description: "Turn the outing into a simple plan for people, place, conditions, equipment, entry, and exit."
  },
  {
    lesson_id: "R14",
    title: "Buddy Communication and Awareness",
    description: "Keep the most universal beginner habit visible: staying aware of your buddy and agreeing on simple signals."
  },
  {
    lesson_id: "R17",
    title: "Entry and Exit Techniques",
    description: "Prepare the practical transition between shore, boat, or platform and the water."
  }
];

// Presentation-only scaffolding (diagram placeholders) that has no wording
// in public-copy.md. Kept separate and clearly labeled so it is never
// confused with editable lesson copy that must come from the canonical
// source. Each entry is inserted immediately after the given paragraph.
const PRESENTATION_PLACEHOLDERS = {
  R12: [
    {
      afterParagraph: "This is a conditions-awareness lesson, not emergency-response training.",
      html: '<div class="learning-visual-placeholder" role="note">Rip-current diagram planned here</div>'
    },
    {
      afterParagraph: "For snorkelers and other water users, the key risk is direction: a rip current moves away from shore.",
      html: '<div class="learning-visual-placeholder" role="note">Current-direction comparison diagram planned here</div>'
    }
  ]
};

function escapeHtmlText(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineHtml(text) {
  let out = escapeHtmlText(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

function markdownBodyToHtml(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push(`<p>${inlineHtml(paragraphLines.join(" "))}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    const hasContinuation = listItems.some((item) => item.continuation);

    if (listType === "ordered" && hasContinuation) {
      const items = listItems
        .map((item) => `<li><strong>${inlineHtml(item.main)}</strong><span>${inlineHtml(item.continuation || "")}</span></li>`)
        .join("\n          ");
      blocks.push(`<ol class="learning-rule-list">\n          ${items}\n        </ol>`);
    } else {
      const tag = listType === "ordered" ? "ol" : "ul";
      const items = listItems.map((item) => `<li>${inlineHtml(item.main)}</li>`).join("\n          ");
      blocks.push(`<${tag}>\n          ${items}\n        </${tag}>`);
    }

    listItems = [];
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const headingMatch = /^(#{2,4})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${inlineHtml(headingMatch[2])}</h${level}>`);
      continue;
    }

    const orderedMatch = /^(\d+)\.\s+(.+)$/.exec(line);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ordered") flushList();
      listType = "ordered";
      listItems.push({ main: orderedMatch[2], continuation: null });
      continue;
    }

    const unorderedMatch = /^[-*]\s+(.+)$/.exec(line);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "unordered") flushList();
      listType = "unordered";
      listItems.push({ main: unorderedMatch[1], continuation: null });
      continue;
    }

    if (/^\s{2,}\S/.test(rawLine) && listItems.length) {
      listItems[listItems.length - 1].continuation = line;
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return `\n        ${blocks.join("\n        ")}\n      `;
}

function splitKnowledgeCheck(lessonBody) {
  const marker = "## Knowledge Check\n\n";
  const idx = String(lessonBody ?? "").indexOf(marker);
  if (idx < 0) return { knowledgeCheckMarkdown: "" };
  return { knowledgeCheckMarkdown: lessonBody.slice(idx + marker.length).trim() };
}

function parseKnowledgeCheckQuestions(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const questions = [];
  let current = null;

  const pushCurrent = () => {
    if (current) questions.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const qMatch = /^\*\*Q\d+\.\s+(.+?)\*\*$/.exec(line);
    if (qMatch) {
      pushCurrent();
      current = { question: qMatch[1].trim(), answers: [], correctLetter: null, explanation: "" };
      continue;
    }

    const answerMatch = /^-\s+([A-Z])\.\s+(.+)$/.exec(line);
    if (answerMatch && current) {
      current.answers.push(answerMatch[2].trim());
      continue;
    }

    const correctMatch = /^\*\*Correct:\*\*\s*([A-Z])$/.exec(line);
    if (correctMatch && current) {
      current.correctLetter = correctMatch[1];
      continue;
    }

    const explanationMatch = /^\*\*Explanation:\*\*\s*(.+)$/.exec(line);
    if (explanationMatch && current) {
      current.explanation = explanationMatch[1].trim();
      continue;
    }
  }
  pushCurrent();

  return questions.map((q) => ({
    question: q.question,
    answers: q.answers,
    correct_index: q.correctLetter ? q.correctLetter.charCodeAt(0) - 65 : 0,
    explanation: q.explanation
  }));
}

function bulletArray(markdown) {
  return String(markdown ?? "")
    .split(/\r?\n/)
    .map((line) => /^-\s+(.+)$/.exec(line.trim()))
    .filter(Boolean)
    .map((match) => match[1].trim());
}

function injectPresentationPlaceholders(html, lessonId) {
  const placeholders = PRESENTATION_PLACEHOLDERS[lessonId] || [];
  return placeholders.reduce((result, { afterParagraph, html: injected }) => {
    const marker = `<p>${inlineHtml(afterParagraph)}</p>`;
    return result.replace(marker, `${marker}\n        ${injected}`);
  }, html);
}

function buildLessonFixture(entry) {
  const fields = entry.fields;
  const { knowledgeCheckMarkdown } = splitKnowledgeCheck(fields.lesson_body);

  return {
    type: "learning_lesson",
    handle: entry.handle,
    lesson_id: fields.lesson_id,
    title: fields.title,
    short_description: fields.short_description,
    lesson_type: fields.lesson_type,
    category: fields.category,
    estimated_reading_time: fields.estimated_reading_time,
    lesson_body_html: injectPresentationPlaceholders(markdownBodyToHtml(fields.lesson_body), fields.lesson_id),
    knowledge_check: { questions: parseKnowledgeCheckQuestions(knowledgeCheckMarkdown) },
    instructor_tips: bulletArray(fields.instructor_tips),
    common_mistakes: bulletArray(fields.common_mistakes),
    safety_notes: bulletArray(fields.safety_notes),
    key_takeaways: fields.key_takeaways || []
  };
}

function jsIndent(text, spaces) {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}

function serializeLessonFixture(fixture) {
  const lines = [];
  lines.push("{");
  lines.push(`  type: '${fixture.type}',`);
  lines.push(`  handle: '${fixture.handle}',`);
  lines.push(`  lesson_id: '${fixture.lesson_id}',`);
  lines.push(`  title: ${JSON.stringify(fixture.title)},`);
  lines.push(`  short_description: ${JSON.stringify(fixture.short_description)},`);
  lines.push(`  lesson_type: ${JSON.stringify(fixture.lesson_type)},`);
  lines.push(`  category: '${fixture.category}',`);
  lines.push(`  estimated_reading_time: ${JSON.stringify(fixture.estimated_reading_time)},`);
  lines.push(`  lesson_body_html: \`${fixture.lesson_body_html}\`,`);
  lines.push("  knowledge_check: {");
  lines.push("    questions: [");
  lines.push(
    fixture.knowledge_check.questions
      .map((q) =>
        [
          "      {",
          `        question: ${JSON.stringify(q.question)},`,
          "        answers: [",
          q.answers.map((a) => `          ${JSON.stringify(a)}`).join(",\n"),
          "        ],",
          `        correct_index: ${q.correct_index},`,
          `        explanation: ${JSON.stringify(q.explanation)}`,
          "      }"
        ].join("\n")
      )
      .join(",\n")
  );
  lines.push("    ]");
  lines.push("  },");
  lines.push(`  instructor_tips: [\n${fixture.instructor_tips.map((t) => `    ${JSON.stringify(t)}`).join(",\n")}\n  ],`);
  lines.push(`  common_mistakes: [\n${fixture.common_mistakes.map((t) => `    ${JSON.stringify(t)}`).join(",\n")}\n  ],`);
  lines.push(`  safety_notes: [${fixture.safety_notes.length ? `\n${fixture.safety_notes.map((t) => `    ${JSON.stringify(t)}`).join(",\n")}\n  ` : ""}],`);
  lines.push(`  key_takeaways: [\n${fixture.key_takeaways.map((t) => `    ${JSON.stringify(t)}`).join(",\n")}\n  ]`);
  lines.push("}");
  return lines.join("\n");
}

function serializeStringArray(values, indent) {
  return `[\n${values.map((v) => `${" ".repeat(indent)}${JSON.stringify(v)}`).join(",\n")}\n${" ".repeat(indent - 2)}]`;
}

const categories = loadCategories();
const lessons = loadLessons()
  .map(buildLessonFixture)
  .sort((a, b) => a.lesson_id.localeCompare(b.lesson_id));

const categoriesBlock = categories
  .map(
    (c) =>
      `    {\n      type: 'learning_category',\n      handle: '${c.handle}',\n      title: ${JSON.stringify(c.fields.title)},\n      short_description: ${JSON.stringify(c.fields.short_description)},\n      sort_order: ${c.fields.sort_order}\n    }`
  )
  .join(",\n");

const startHereBlock = START_HERE.map(
  (item) =>
    `    {\n      lesson_id: '${item.lesson_id}',\n      title: ${JSON.stringify(item.title)},\n      description: ${JSON.stringify(item.description)}\n    }`
).join(",\n");

const lessonsBlock = lessons.map((fixture) => jsIndent(serializeLessonFixture(fixture), 4)).join(",\n");

const output = `// GENERATED FILE -- DO NOT EDIT BY HAND.
// Regenerate with: npm run learning:generate-preview-fixture (from shopify/)
//
// Sources:
//   - Lesson wording (title, short description, body, headings, key takeaways,
//     instructor tips, common mistakes, safety notes, knowledge check):
//     shopify/data/lessons/*.json, itself generated from
//     content-development/lessons/*/public-copy.md via
//     shopify/scripts/generate-pilot-data.js. Edit public-copy.md, not this file.
//   - Category title/short description: shopify/data/categories.json.
//   - Homepage and "Start Here" marketing copy has no canonical public-copy.md
//     source; it is hand-authored in
//     shopify/scripts/generate-preview-fixture.js and generated into this file.
window.OOLearningHubPreviewData = {
  preview: {
    mode: 'development-only',
    source: 'Approved Stage 5C public Shopify fixture shape',
    removeBeforeProduction: true
  },
  homepage: {
    heading: ${JSON.stringify(HOMEPAGE.heading)},
    intro: ${serializeStringArray(HOMEPAGE.intro, 6)},
    primaryCta: ${JSON.stringify(HOMEPAGE.primaryCta)},
    secondaryCta: ${JSON.stringify(HOMEPAGE.secondaryCta)},
    startHeading: ${JSON.stringify(HOMEPAGE.startHeading)},
    startCopy: ${serializeStringArray(HOMEPAGE.startCopy, 6)},
    startCta: ${JSON.stringify(HOMEPAGE.startCta)},
    featuredHeading: ${JSON.stringify(HOMEPAGE.featuredHeading)},
    whyHeading: ${JSON.stringify(HOMEPAGE.whyHeading)},
    whyCopy: ${serializeStringArray(HOMEPAGE.whyCopy, 6)},
    bottomHeading: ${JSON.stringify(HOMEPAGE.bottomHeading)},
    bottomCopy: ${JSON.stringify(HOMEPAGE.bottomCopy)},
    bottomPrimaryCta: ${JSON.stringify(HOMEPAGE.bottomPrimaryCta)},
    bottomSecondaryCta: ${JSON.stringify(HOMEPAGE.bottomSecondaryCta)}
  },
  startHere: [
${startHereBlock}
  ],
  categories: [
${categoriesBlock}
  ],
  lessons: [
${lessonsBlock}
  ]
};
`;

fs.writeFileSync(OUTPUT_PATH, output);
console.log(`Generated ${path.relative(REPO_ROOT, OUTPUT_PATH)}`);
