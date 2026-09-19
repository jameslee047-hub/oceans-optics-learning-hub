import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, SHOPIFY_ROOT, loadApprovedLessons, parseKnowledgeCheckQuestions, resolveContentMarker, resolveDownloadMarker } from "./lib/learning-data.js";

const lessons = [
  "content-development/lessons/R01-choosing-a-mask",
  "content-development/lessons/R02-mask-fit-positioning-adjustment",
  "content-development/lessons/R03-mask-preparation-defogging-care",
  "content-development/lessons/R04-choosing-and-setting-up-a-snorkel",
  "content-development/lessons/R05-choosing-fins",
  "content-development/lessons/R06-exposure-protection-staying-warm",
  "content-development/lessons/R07-health-readiness-and-personal-responsibility",
  "content-development/lessons/R08-golden-rules-for-safer-snorkeling",
  "content-development/lessons/R09-surface-safety-devices",
  "content-development/lessons/R10-pre-snorkel-checklist-and-planning",
  "content-development/lessons/R11-beach-flags-and-surface-warnings",
  "content-development/lessons/R12-currents-and-rip-currents",
  "content-development/lessons/R13-waves-tides-and-surge",
  "content-development/lessons/R14-buddy-communication-and-awareness",
  "content-development/lessons/R15-breath-hold-safety-co2-and-shallow-water-blackout",
  "content-development/lessons/R16-snorkeling-emergencies-recognition-and-preparedness",
  "content-development/lessons/R17-entry-and-exit-techniques",
  "content-development/lessons/R18-clearing-your-snorkel",
  "content-development/lessons/R19-duck-diving-basics",
  "content-development/lessons/R20-mask-clearing-techniques",
  "content-development/lessons/R21-efficient-kicking-techniques",
  "content-development/lessons/R22-relaxed-breathing-and-efficient-movement",
  "content-development/lessons/R23-floating-and-treading-water",
  "content-development/lessons/R24-buoyancy-pressure-and-airspaces",
  "content-development/lessons/R25-light-vision-and-sound-underwater",
  "content-development/lessons/R26-equalizing-basics",
  "content-development/lessons/R27-why-you-get-cold-in-water",
  "content-development/lessons/R28-types-of-snorkeling-experiences",
  "content-development/lessons/R29-marine-life-basics",
  "content-development/lessons/R30-coral-conservation-and-responsible-behavior",
  "content-development/lessons/R31-prescription-masks-nearsightedness-farsightedness-lens-selection"
];

const categoryHandles = {
  "Gear, Masks & Vision": "gear-masks-vision",
  "Safety & Conditions": "safety-conditions",
  "In-Water Skills": "in-water-skills",
  "Underwater Science & Your Body": "underwater-science-your-body",
  "Marine Life & Conservation": "marine-life-conservation"
};

const approvedById = new Map(loadApprovedLessons().map((lesson) => [lesson.lesson_id, lesson]));

const PUBLIC_H2_HEADINGS = new Set([
  "Public Fields",
  "Choosing a Mask",
  "Start With Intended Use",
  "Fit and Seal Matter Most",
  "Mask Volume as a Basic Selection Concept",
  "Do You Need Vision Correction?",
  "Single-Lens vs. Dual-Lens Masks",
  "Clear Skirt vs. Dark or Black Skirt",
  "Prescription Compatibility",
  "A Practical Mask Shortlist",
  "Related Lessons / Next Step",
  "Instructor Tips",
  "Common Mistakes",
  "Safety Note",
  "Safety Notes",
  "Key Takeaways",
  "Knowledge Check",
  "References & Further Reading"
]);

const PUBLIC_H3_HEADINGS = new Set([
  "Single-Lens Masks",
  "Dual-Lens Masks",
  "Clear Skirt",
  "Dark or Black Skirt",
  "Which to Choose?",
  "SPH",
  "CYL",
  "AXIS",
  "ADD"
]);

const BODY_EXCLUDED_SECTIONS = new Set([
  "Public Fields",
  "Related Lessons / Next Step",
  "Instructor Tips",
  "Common Mistakes",
  "Safety Note",
  "Safety Notes",
  "Key Takeaways",
  "Knowledge Check"
]);

const STRUCTURED_MARKER_LINE = /^\[(TOOL|PRODUCT|CTA|DOWNLOAD|MEDIA):\s*[^\]]+\]$/;
const ACTION_MARKER_LINE = /^\[(TOOL|PRODUCT|CTA):\s*[^\]]+\]$/;
const INLINE_MEDIA_MARKER_LINE = /^\[MEDIA:\s*[^\]]+\]$/;
const INLINE_MARKER_LINE = /^\[(TOOL|PRODUCT|CTA|MEDIA):\s*[^\]]+\]$/;

function stripTicks(value) {
  return String(value ?? "").replace(/^`|`$/g, "").trim();
}

function stripCustomerLessonId(value) {
  return String(value ?? "").replace(/\bR\d{2}\s+(?=[A-Z])/g, "").trim();
}

function plainLessonLinkText(value) {
  return String(value ?? "").replace(/\[([^\]]+)\]\(lesson:[^)]+\)/g, "$1");
}

function findSection(content, startHeading, endHeading) {
  const start = content.indexOf(startHeading);
  if (start < 0) return "";
  const bodyStart = start + startHeading.length;
  const end = endHeading ? content.indexOf(endHeading, bodyStart) : -1;
  return content.slice(bodyStart, end >= 0 ? end : content.length).trim();
}

function findH2Section(markdown, title) {
  const matches = [...String(markdown ?? "").matchAll(/^## (.+)$/gm)];
  const start = matches.find((match) => match[1].trim() === title);
  if (!start) return "";
  const next = matches.find((match) => match.index > start.index);
  const bodyStart = start.index + start[0].length;
  const end = next ? next.index : markdown.length;
  return markdown.slice(bodyStart, end).trim();
}

function normalizePublicCopyMarkdown(markdown, title) {
  let seenDocumentTitle = false;

  return String(markdown ?? "")
    .split(/\r?\n/)
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line || /^#{1,6}\s+/.test(line)) return rawLine;
      if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) return rawLine;
      if (/^\[(TOOL|PRODUCT|CTA|DOWNLOAD|MEDIA):\s*[^\]]+\]$/.test(line)) return rawLine;
      if (/^Q\d+\.\s+/.test(line) || /^Correct:\s+/i.test(line) || /^Explanation:\s+/i.test(line)) return rawLine;

      if (line === title) {
        if (!seenDocumentTitle) {
          seenDocumentTitle = true;
          return `# ${line}`;
        }
        return `## ${line}`;
      }

      if (PUBLIC_H3_HEADINGS.has(line)) return `### ${line}`;
      if (PUBLIC_H2_HEADINGS.has(line)) return `## ${line}`;

      return rawLine;
    })
    .join("\n");
}

function bulletValue(section, key) {
  const pattern = new RegExp(`^- ${key}:\\s*(.+)$`, "m");
  const match = pattern.exec(section);
  return match ? stripTicks(match[1]) : null;
}

function parseOptionalSections(markdown) {
  const sections = {};
  const matches = [...markdown.matchAll(/^## (.+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    const title = match[1].trim();
    const start = match.index + match[0].length;
    const end = next ? next.index : markdown.length;
    sections[title] = markdown.slice(start, end).trim();
  }
  return sections;
}

function parsePublicLessonBody(markdown) {
  const matches = [...String(markdown ?? "").matchAll(/^## (.+)$/gm)];
  const sections = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = match[1].trim();

    const next = matches[index + 1];
    const bodyStart = match.index + match[0].length;
    const end = next ? next.index : markdown.length;
    const sectionLines = markdown.slice(bodyStart, end).split(/\r?\n/);

    if (BODY_EXCLUDED_SECTIONS.has(title)) {
      if (title === "Related Lessons / Next Step") {
        const actionLines = sectionLines
          .map((line) => line.trim())
          .filter((line) => ACTION_MARKER_LINE.test(line) || INLINE_MEDIA_MARKER_LINE.test(line));
        if (actionLines.length) sections.push(actionLines.join("\n\n"));
      }
      continue;
    }

    const body = sectionLines
      .filter((line) => !STRUCTURED_MARKER_LINE.test(line.trim()) || INLINE_MARKER_LINE.test(line.trim()))
      .join("\n")
      .trim();
    if (body) sections.push(`## ${title}\n\n${body}`);
  }

  return sections.join("\n\n").trim();
}

function parseBulletList(markdown) {
  return String(markdown ?? "")
    .split(/\r?\n/)
    .map((line) => /^-\s+(.+)$/.exec(line.trim()))
    .filter(Boolean)
    .map((match) => stripCustomerLessonId(match[1].replace(/`/g, "")));
}

function labelFromHandle(handle) {
  return handle.replace(/-/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function parsePlaceholders(markdown, kind) {
  const pattern = new RegExp(`\\[${kind}:\\s*([^\\]]+)\\]`, "g");
  return [...String(markdown ?? "").matchAll(pattern)].map((match) => {
    if (["TOOL", "PRODUCT", "CTA"].includes(kind)) {
      return resolveContentMarker(kind, match[1]);
    }

    if (kind === "DOWNLOAD") {
      return resolveDownloadMarker(match[1]);
    }

    const handle = match[1].trim();
    return { handle, label: labelFromHandle(handle), url: null, gid: null, file_gid: null };
  });
}

function uniquePlaceholders(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.kind || ""}:${item.handle || item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readPublicLessonIndex() {
  const lessonRoot = path.join(REPO_ROOT, "content-development", "lessons");
  const byId = new Map(approvedById);
  if (!fs.existsSync(lessonRoot)) return byId;

  for (const dirent of fs.readdirSync(lessonRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const match = /^(R\d{2})-(.+)$/.exec(dirent.name);
    if (!match) continue;

    const publicCopyPath = path.join(lessonRoot, dirent.name, "public-copy.md");
    let title = byId.get(match[1])?.title || match[2].replace(/-/g, " ");

    if (fs.existsSync(publicCopyPath)) {
      const publicCopy = fs.readFileSync(publicCopyPath, "utf8");
      const titleMatch = /^-\s+Title:\s*(.+)$/m.exec(publicCopy);
      const firstLine = publicCopy
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      title = stripTicks(titleMatch?.[1] || firstLine?.replace(/^#+\s+/, "") || title);
    }

    byId.set(match[1], {
      lesson_id: match[1],
      title,
      handle: match[2]
    });
  }

  return byId;
}

const lessonIndexById = readPublicLessonIndex();
const lessonsByTitle = [...lessonIndexById.values()]
  .filter((lesson) => lesson.title)
  .sort((a, b) => b.title.length - a.title.length);

function titleKey(value) {
  return stripCustomerLessonId(value)
    .replace(/`/g, "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function matchRelatedLesson(text) {
  const plainText = plainLessonLinkText(text);
  const cleanText = stripCustomerLessonId(plainText.replace(/`/g, ""));
  const explicitId = /\b(R\d{2})\b/.exec(text);
  if (explicitId && lessonIndexById.has(explicitId[1])) {
    const lesson = lessonIndexById.get(explicitId[1]);
    return { lesson, matchedTitle: lesson.title };
  }

  const cleanKey = titleKey(cleanText);
  for (const lesson of lessonsByTitle) {
    const lessonTitleKey = titleKey(lesson.title);
    if (cleanKey === lessonTitleKey || cleanKey.startsWith(`${lessonTitleKey} `)) {
      return { lesson, matchedTitle: lesson.title };
    }
  }

  return { lesson: null, matchedTitle: "" };
}

function splitRelatedFallback(text) {
  const match = /^(.+?)\s+(for|if|before|when|to)\s+(.+)$/i.exec(text);
  if (!match) return { title: text, description: "" };
  return {
    title: match[1].trim(),
    description: `${match[2]} ${match[3]}`.trim()
  };
}

function descriptionFromRelatedLine(text, matchedTitle) {
  if (!matchedTitle || !text.toLowerCase().startsWith(matchedTitle.toLowerCase())) return "";
  let description = text.slice(matchedTitle.length).trim().replace(/^[—:-]\s*/, "");
  description = description.replace(/^for\s+/i, "");
  if (/^[a-z]/.test(description)) description = `${description.charAt(0).toUpperCase()}${description.slice(1)}`;
  return description;
}

function parseRelatedLessons(markdown) {
  return String(markdown ?? "")
    .split(/\r?\n/)
    .map((line) => /^[-*]\s+(.+)$/.exec(line.trim()))
    .filter(Boolean)
    .map((match) => {
      const text = stripCustomerLessonId(plainLessonLinkText(match[1]).replace(/`/g, ""));
      const { lesson, matchedTitle } = matchRelatedLesson(match[1]);
      const fallback = splitRelatedFallback(text);
      return {
        lesson_id: lesson?.lesson_id ?? null,
        title: lesson?.title ?? fallback.title,
        handle: lesson?.handle ?? null,
        description: lesson ? descriptionFromRelatedLine(text, matchedTitle) : fallback.description
      };
    })
}

function cleanPerson(value) {
  if (!value) return null;
  if (/codex|draft|unassigned|not yet reviewed/i.test(value)) return null;
  return value;
}

function cleanDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return null;
  return value;
}

function readOptionalFile(relativeDir, filename) {
  const filePath = path.join(REPO_ROOT, relativeDir, filename);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function slugFromDirectoryName(relativeDir) {
  const match = /^(R\d{2})-(.+)$/.exec(path.basename(relativeDir));
  return match ? match[2] : null;
}

function categoryFromLessonBrief(lessonBrief) {
  const match = /^Category:\s*(.+)$/m.exec(String(lessonBrief ?? ""));
  return match ? match[1].trim() : null;
}

function lessonTypeFromLessonBrief(lessonBrief) {
  const match = /^Lesson type:\s*(.+)$/m.exec(String(lessonBrief ?? ""));
  return match ? match[1].trim() : null;
}

function normalizeLesson(relativeDir) {
  const publicCopy = fs.readFileSync(path.join(REPO_ROOT, relativeDir, "public-copy.md"), "utf8");
  // internal-notes.md exists only for the earliest-normalized lessons (R01/R08/R12).
  // Newer lessons (R02-R06, R31) carry the same canonical data directly in their
  // already-headed public-copy.md plus lesson-brief.md's Category line -- this
  // branch reads that instead of inventing anything internal-notes.md would have held.
  const internalNotes = readOptionalFile(relativeDir, "internal-notes.md");
  const lessonBrief = internalNotes ? null : readOptionalFile(relativeDir, "lesson-brief.md");
  const core = internalNotes ? findSection(internalNotes, "## Core Metadata", "## Source Material") : "";
  const editorialStatus = internalNotes ? findH2Section(internalNotes, "Editorial Status") : "";
  const coreTitle = bulletValue(core, "Title");
  const normalizedPublicCopy = normalizePublicCopyMarkdown(publicCopy, coreTitle);
  const publicFields = findH2Section(normalizedPublicCopy, "Public Fields");
  const optional = parseOptionalSections(normalizedPublicCopy);
  const relatedNextStep = findH2Section(normalizedPublicCopy, "Related Lessons / Next Step");
  const mainBody = parsePublicLessonBody(normalizedPublicCopy);

  const lessonId = bulletValue(core, "Lesson ID") || bulletValue(publicFields, "Lesson ID");
  const title = bulletValue(publicFields, "Title") || coreTitle;
  const slug = bulletValue(core, "Slug") || slugFromDirectoryName(relativeDir);
  const category = bulletValue(core, "Primary category") || categoryFromLessonBrief(lessonBrief);
  const knowledgeCheck = optional["Knowledge Check"];
  const lessonBody = mainBody;
  // Kept out of lesson_body entirely (unlike the legacy behavior of appending
  // it as trailing rich text): a flat rich-text field can't hide the correct
  // answer, so the production quiz widget (learning-hub-knowledge-check.js)
  // renders this structured data client-side instead. Not a Shopify schema
  // field -- generate-preview-fixture.js reads it to emit the production
  // learning-hub-knowledge-check-data.js file, and it is otherwise ignored by
  // every script that sends fields to Shopify (buildUpsertPayload /
  // buildLessonCreateInput only iterate the fields defined in
  // shopify/schema/definitions.json).
  const knowledgeCheckQuestions = knowledgeCheck ? parseKnowledgeCheckQuestions(knowledgeCheck) : [];
  const ctas = uniquePlaceholders(parsePlaceholders(normalizedPublicCopy, "CTA"));
  const publicDownloads = parsePlaceholders(normalizedPublicCopy, "DOWNLOAD");
  const internalDownloads = internalNotes ? parsePlaceholders(findH2Section(internalNotes, "Downloadable Resources"), "DOWNLOAD") : [];
  const publicRelatedLessons = parseRelatedLessons(relatedNextStep);
  const relatedLessons = publicRelatedLessons.length
    ? publicRelatedLessons
    : internalNotes
      ? parseRelatedLessons(findH2Section(internalNotes, "Related Lessons"))
      : [];

  return {
    type: "learning_lesson",
    handle: slug,
    publication_status: "DRAFT",
    fields: {
      title,
      short_description: bulletValue(publicFields, "Short description") || bulletValue(core, "Short description"),
      lesson_type: bulletValue(core, "Lesson type") || lessonTypeFromLessonBrief(lessonBrief),
      category: categoryHandles[category],
      estimated_reading_time: bulletValue(publicFields, "Estimated reading time") || bulletValue(core, "Estimated reading time"),
      hero_media: null,
      lesson_body: lessonBody,
      knowledge_check: knowledgeCheckQuestions.length ? { questions: knowledgeCheckQuestions } : null,
      instructor_tips: optional["Instructor Tips"] || null,
      common_mistakes: optional["Common Mistakes"] || null,
      safety_notes: optional["Safety Notes"] || optional["Safety Note"] || null,
      key_takeaways: parseBulletList(optional["Key Takeaways"]),
      related_lessons: relatedLessons,
      related_tools: uniquePlaceholders(parsePlaceholders(normalizedPublicCopy, "TOOL")),
      related_products: uniquePlaceholders(parsePlaceholders(normalizedPublicCopy, "PRODUCT")),
      downloadable_resources: uniquePlaceholders([...internalDownloads, ...publicDownloads])
        .filter((entry) => entry.url || entry.gid || entry.file_gid),
      primary_cta: ctas[0] || null,
      lesson_id: lessonId,
      author: cleanPerson(bulletValue(editorialStatus, "Author")),
      reviewer: cleanPerson(bulletValue(editorialStatus, "Reviewer")),
      last_reviewed: cleanDate(bulletValue(editorialStatus, "Last reviewed")),
      seo_title: bulletValue(publicFields, "SEO title"),
      meta_description: bulletValue(publicFields, "Meta description")
    }
  };
}

const outDir = path.join(SHOPIFY_ROOT, "data", "lessons");
fs.mkdirSync(outDir, { recursive: true });

for (const lesson of lessons) {
  const entry = normalizeLesson(lesson);
  const fileName = `${entry.fields.lesson_id}-${entry.handle}.json`;
  fs.writeFileSync(path.join(outDir, fileName), `${JSON.stringify(entry, null, 2)}\n`);
  console.log(`Generated ${path.join("data", "lessons", fileName)}`);
}
