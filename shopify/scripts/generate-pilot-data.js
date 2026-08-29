import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, SHOPIFY_ROOT, loadApprovedLessons } from "./lib/learning-data.js";

const lessons = [
  "content-development/lessons/R01-choosing-a-mask",
  "content-development/lessons/R08-golden-rules-for-safer-snorkeling",
  "content-development/lessons/R12-currents-and-rip-currents"
];

const categoryHandles = {
  "Gear, Masks & Vision": "gear-masks-vision",
  "Safety & Conditions": "safety-conditions",
  "In-Water Skills": "in-water-skills",
  "Underwater Science & Your Body": "underwater-science-your-body",
  "Marine Life & Conservation": "marine-life-conservation"
};

const approvedById = new Map(loadApprovedLessons().map((lesson) => [lesson.lesson_id, lesson]));

function stripTicks(value) {
  return String(value ?? "").replace(/^`|`$/g, "").trim();
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
  const optionalTitles = new Set(["Instructor Tips", "Common Mistakes", "Safety Notes", "Key Takeaways", "Knowledge Check"]);
  const matches = [...String(markdown ?? "").matchAll(/^## (.+)$/gm)];
  const sections = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = match[1].trim();
    if (title === "Public Fields") continue;
    if (optionalTitles.has(title)) break;

    const next = matches[index + 1];
    const bodyStart = match.index + match[0].length;
    const end = next ? next.index : markdown.length;
    sections.push(`## ${title}\n\n${markdown.slice(bodyStart, end).trim()}`);
  }

  return sections.join("\n\n").trim();
}

function parseBulletList(markdown) {
  return String(markdown ?? "")
    .split(/\r?\n/)
    .map((line) => /^-\s+(.+)$/.exec(line.trim()))
    .filter(Boolean)
    .map((match) => match[1].replace(/`/g, "").trim());
}

function labelFromHandle(handle) {
  return handle.replace(/-/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function parsePlaceholders(markdown, kind) {
  const pattern = new RegExp(`\\[${kind}:\\s*([^\\]]+)\\]`, "g");
  return [...String(markdown ?? "").matchAll(pattern)].map((match) => {
    const handle = match[1].trim();
    return {
      handle,
      label: labelFromHandle(handle),
      url: null,
      gid: null,
      file_gid: null
    };
  });
}

function parseRelatedLessons(markdown) {
  return String(markdown ?? "")
    .split(/\r?\n/)
    .map((line) => /`(R\d{2})\s+([^`]+)`/.exec(line))
    .filter(Boolean)
    .map((match) => {
      const approved = approvedById.get(match[1]);
      return {
        lesson_id: match[1],
        title: approved?.title ?? match[2].trim(),
        handle: approved?.handle ?? null
      };
    })
    .filter((entry) => entry.handle);
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

function normalizeLesson(relativeDir) {
  const publicCopy = fs.readFileSync(path.join(REPO_ROOT, relativeDir, "public-copy.md"), "utf8");
  const internalNotes = fs.readFileSync(path.join(REPO_ROOT, relativeDir, "internal-notes.md"), "utf8");
  const core = findSection(internalNotes, "## Core Metadata", "## Source Material");
  const editorialStatus = findH2Section(internalNotes, "Editorial Status");
  const publicFields = findH2Section(publicCopy, "Public Fields");
  const optional = parseOptionalSections(publicCopy);
  const mainBody = parsePublicLessonBody(publicCopy);

  const lessonId = bulletValue(core, "Lesson ID");
  const title = bulletValue(publicFields, "Title") || bulletValue(core, "Title");
  const slug = bulletValue(core, "Slug");
  const category = bulletValue(core, "Primary category");
  const knowledgeCheck = optional["Knowledge Check"];
  const lessonBody = [mainBody, knowledgeCheck ? `## Knowledge Check\n\n${knowledgeCheck}` : ""].filter(Boolean).join("\n\n");

  return {
    type: "learning_lesson",
    handle: slug,
    publication_status: "DRAFT",
    fields: {
      title,
      short_description: bulletValue(publicFields, "Short description") || bulletValue(core, "Short description"),
      lesson_type: bulletValue(core, "Lesson type"),
      category: categoryHandles[category],
      estimated_reading_time: bulletValue(publicFields, "Estimated reading time") || bulletValue(core, "Estimated reading time"),
      hero_media: null,
      lesson_body: lessonBody,
      instructor_tips: optional["Instructor Tips"] || null,
      common_mistakes: optional["Common Mistakes"] || null,
      safety_notes: optional["Safety Notes"] || null,
      key_takeaways: parseBulletList(optional["Key Takeaways"]),
      related_lessons: parseRelatedLessons(findH2Section(internalNotes, "Related Lessons")),
      related_tools: parsePlaceholders(findH2Section(internalNotes, "Related Tools"), "TOOL"),
      related_products: parsePlaceholders(findH2Section(internalNotes, "Related Products"), "PRODUCT"),
      downloadable_resources: parsePlaceholders(findH2Section(internalNotes, "Downloadable Resources"), "DOWNLOAD"),
      primary_cta: parsePlaceholders(findH2Section(internalNotes, "Internal CTA / implementation references"), "CTA")[0] || null,
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
