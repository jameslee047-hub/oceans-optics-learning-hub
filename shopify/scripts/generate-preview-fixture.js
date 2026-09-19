import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  LEARNING_MEDIA_LAYOUTS,
  REPO_ROOT,
  loadApprovedLessons,
  loadCategories,
  loadLearningMediaRegistry,
  loadLessons,
  loadPublicLaunchLessonHandles,
  parseContentMarker,
  parseMediaMarker,
  resolveContentMarker,
  resolveLearningMediaMarker
} from "./lib/learning-data.js";

// Written to a content-hashed filename, not a fixed one: Shopify's CDN for
// theme assets was confirmed (via direct byte comparison against the Admin
// API's authoritative asset content) to cache by path only, ignoring the
// `?v=`/any query string entirely -- a content-only re-push of a FIXED
// filename can leave the CDN edge serving a stale response indefinitely
// (observed max-age ~1 year), with no query-string workaround available.
// Inlining the ~300KB+ fixture data directly into a Liquid snippet was tried
// and rejected -- Shopify enforces a 256KB limit on Liquid template files,
// which this content already exceeds. Instead, the data stays a plain static
// asset (no size limit there) under a filename that changes whenever content
// changes, so the CDN has genuinely never cached that exact path before. A
// tiny separate Liquid snippet (see SCRIPT_TAG_SNIPPET_PATH below) holds only
// the <script src> tag pointing at the current hashed filename, and IS
// rendered inline on the always-dynamic (never cached) dev-preview page, so
// that pointer itself is never stale.
const ASSETS_DIR = path.join(REPO_ROOT, "theme/learning-hub-pilot/assets");
const SCRIPT_TAG_SNIPPET_PATH = path.join(REPO_ROOT, "theme/learning-hub-pilot/snippets/learning-hub-preview-data-script-tag.liquid");
const mediaRegistry = loadLearningMediaRegistry();

// content-development/media/learning-media.json is a hand-authored local
// fixture, not a schema-enforced Shopify metaobject -- any field name typed
// into it reaches this file's raw JSON dump verbatim. Any key prefixed
// `internal_` (the same convention the proposed `learning_media` Shopify
// schema uses for `internal_editor_note`, documented as "never rendered
// publicly") is stripped here before that dump, so internal authoring/
// provenance notes can never leak into the customer-facing page regardless
// of which specific field name a future editor picks.
function stripInternalFields(value) {
  if (Array.isArray(value)) return value.map(stripInternalFields);
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith("internal_")) continue;
      result[key] = stripInternalFields(val);
    }
    return result;
  }
  return value;
}

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
    "Oceans Optics was built by snorkelers and scuba instructors who wanted more people to fall in love with the ocean the way we did. The right gear is only part of that. Knowing what you're doing is the rest.",
    "We've watched too many people grab a mask and snorkel and just go, with no briefing and no idea what to look out for. This learning zone is where that changes.",
    "From finding a mask that fits properly to understanding underwater vision, currents, equalizing, and basic snorkeling skills, we want reliable knowledge within easy reach before you ever touch the water.",
    "Whether you're at home waiting for your mask to arrive, on the plane, or on the sun lounger before you head down to the water, think of it as having an instructor on call, giving you a clear answer whenever a question comes up."
  ],
  whyProofPoints: [
    "Gear choices explained in plain language",
    "Snorkeling and scuba instructor perspective",
    "Clear next lessons instead of overloaded pages"
  ],
  whyImage: {
    url: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/Clear_RX_Snorkel_Mask_4.jpg?v=1774516593",
    alt: "Clear prescription snorkel mask displayed against a clean background."
  },
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

const INLINE_LESSON_REFERENCE_TITLES = new Set(
  loadApprovedLessons()
    .map((lesson) => lesson.title)
    .concat(["Prescription Masks: Nearsightedness, Farsightedness & Lens Selection"])
    .map((title) => title.toLowerCase().replace(/&amp;/g, "&").replace(/\s+/g, " ").trim())
);

function escapeHtmlText(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripCustomerLessonId(text) {
  return String(text ?? "").replace(/\bR\d{2}\s+(?=[A-Z])/g, "").trim();
}

function stripTicks(value) {
  return String(value ?? "").replace(/^`|`$/g, "").trim();
}

function publicField(markdown, key) {
  const pattern = new RegExp(`^- ${key}:\\s*(.+)$`, "m");
  const match = pattern.exec(markdown);
  return match ? stripCustomerLessonId(stripTicks(match[1])) : null;
}

function fallbackTitleFromPublicCopy(markdown, fallback) {
  const firstLine = String(markdown ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return stripCustomerLessonId(firstLine?.replace(/^#+\s+/, "") || fallback);
}

function readRelatedLessonIndex() {
  const byHandle = new Map(loadApprovedLessons().map((lesson) => [
    lesson.handle,
    {
      lesson_id: lesson.lesson_id,
      handle: lesson.handle,
      title: stripCustomerLessonId(lesson.title),
      short_description: null
    }
  ]));
  const lessonRoot = path.join(REPO_ROOT, "content-development", "lessons");

  if (fs.existsSync(lessonRoot)) {
    for (const dirent of fs.readdirSync(lessonRoot, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      const match = /^(R\d{2})-(.+)$/.exec(dirent.name);
      if (!match) continue;

      const publicCopyPath = path.join(lessonRoot, dirent.name, "public-copy.md");
      const fallbackTitle = dirent.name.slice(4).replace(/-/g, " ");
      let title = byHandle.get(match[2])?.title || fallbackTitle;
      let shortDescription = byHandle.get(match[2])?.short_description || null;

      if (fs.existsSync(publicCopyPath)) {
        const markdown = fs.readFileSync(publicCopyPath, "utf8");
        title = publicField(markdown, "Title") || fallbackTitleFromPublicCopy(markdown, title);
        shortDescription = publicField(markdown, "Short description") || shortDescription;
      }

      byHandle.set(match[2], {
        lesson_id: match[1],
        handle: match[2],
        title: stripCustomerLessonId(title),
        short_description: shortDescription ? stripCustomerLessonId(shortDescription) : null
      });
    }
  }

  return [...byHandle.values()].sort((a, b) => a.handle.localeCompare(b.handle));
}

function isLessonReference(text) {
  const key = stripCustomerLessonId(text).toLowerCase().replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return INLINE_LESSON_REFERENCE_TITLES.has(key);
}

let inlineLessonReferencesByHandle = null;

function inlineLessonReferenceByHandle(handle) {
  if (!inlineLessonReferencesByHandle) {
    inlineLessonReferencesByHandle = new Map(readRelatedLessonIndex().map((lesson) => [lesson.handle, lesson]));
  }

  return inlineLessonReferencesByHandle.get(handle);
}

function inlineHtml(text) {
  let out = escapeHtmlText(text);
  out = out.replace(/\[([^\]]+)\]\(lesson:([a-z0-9-]+)\)/g, (_match, label, handle) => {
    const reference = inlineLessonReferenceByHandle(handle);
    if (!reference) return label;

    return [
      `<a class="learning-inline-reference" href="#preview-${escapeHtmlText(reference.lesson_id.toLowerCase())}">`,
      label,
      "</a>"
    ].join("");
  });
  out = out.replace(/`([^`]+)`/g, (_match, value) => {
    const clean = stripCustomerLessonId(value);
    return isLessonReference(clean)
      ? `<span class="learning-inline-reference">${clean}</span>`
      : `<code>${clean}</code>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

function contentMarkerHtml(kind, rawLabel) {
  const marker = resolveContentMarker(kind, rawLabel);
  const tone = marker.kind === "PRODUCT" ? "collection" : marker.kind.toLowerCase();
  const buttonClass = "button learning-cta";
  const label = escapeHtmlText(marker.label);
  const url = escapeHtmlText(marker.url);

  if (!marker.url) return "";

  return [
    `<div class="learning-inline-action learning-inline-action--${tone}">`,
    `<a class="${buttonClass}" href="${url}">${label}</a>`,
    '</div>'
  ].join("");
}

function htmlAttr(name, value) {
  if (value === undefined || value === null || value === "") return "";
  return ` ${name}="${escapeHtmlText(value)}"`;
}

function mediaWarningHtml(message) {
  return `<aside class="learning-media learning-media--warning" role="note">${escapeHtmlText(message)}</aside>`;
}

// Renders a still image or a GIF (both are plain <img> elements -- a GIF is
// just an image format, it needs no player). Looping video is a distinct
// media_type so the future GIF -> optimized-video swap never touches [MEDIA:]
// or the surrounding markup, only this branch and the registry record.
function visualHtml(item) {
  if (!item?.url && !item?.asset_filename) return "";
  const url = item.url || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  const assetAttr = item.asset_filename ? htmlAttr("data-learning-asset-filename", item.asset_filename) : "";
  const aspect = item.aspect_ratio ? ` style="--learning-media-aspect: ${escapeHtmlText(item.aspect_ratio)};"` : "";

  if (item.media_type === "video") {
    return [
      `<div class="learning-media__image learning-media__image--video"${aspect}>`,
      `<video muted loop playsinline preload="metadata" aria-label="${escapeHtmlText(item.alt)}"${assetAttr}${htmlAttr("width", item.width)}${htmlAttr("height", item.height)}>`,
      `<source src="${escapeHtmlText(url)}">`,
      "</video>",
      "</div>"
    ].join("");
  }

  return [
    `<div class="learning-media__image"${aspect}>`,
    `<img src="${escapeHtmlText(url)}" alt="${escapeHtmlText(item.alt)}" loading="lazy" decoding="async"${assetAttr}${htmlAttr("width", item.width)}${htmlAttr("height", item.height)}>`,
    "</div>"
  ].join("");
}

function mediaItemHtml(item) {
  const visual = visualHtml(item);
  if (!visual) return "";

  return [
    '<div class="learning-media__item">',
    visual,
    item.label ? `<p class="learning-media__label">${escapeHtmlText(item.label)}</p>` : "",
    item.caption ? `<p class="learning-media__item-caption">${escapeHtmlText(item.caption)}</p>` : "",
    item.credit_source ? `<p class="learning-media__credit">${escapeHtmlText(item.credit_source)}</p>` : "",
    "</div>"
  ].join("");
}

function mediaMarkerHtml(rawKey) {
  const media = resolveLearningMediaMarker(rawKey, mediaRegistry);

  if (!media.resolved) {
    return mediaWarningHtml(`Missing Learning Hub media record: ${media.key}`);
  }

  if (!LEARNING_MEDIA_LAYOUTS.has(media.layout)) {
    return mediaWarningHtml(`Unsupported Learning Hub media layout: ${media.layout}`);
  }

  // media_type "video" only ever needs its src URL; a still image or GIF also
  // needs alt text (a Shopify file reference alone isn't renderable here).
  const validItems = media.items.filter((item) => (item.url || item.asset_filename) && (item.alt || item.media_type === "video"));
  if (media.layout === "comparison" && validItems.length < 2) {
    return mediaWarningHtml(`Comparison media requires two resolved images: ${media.key}`);
  }
  if (media.layout !== "comparison" && !validItems.length) {
    return mediaWarningHtml(`Learning Hub media requires at least one resolved item: ${media.key}`);
  }

  let body;
  if (media.layout === "comparison") {
    body = `<div class="learning-media__comparison">${validItems.slice(0, 2).map(mediaItemHtml).join("")}</div>`;
  } else if (media.layout === "gallery") {
    body = `<div class="learning-media__gallery">${validItems.map(mediaItemHtml).join("")}</div>`;
  } else {
    body = mediaItemHtml(validItems[0]);
  }

  // width_treatment is an opt-in, per-record modifier (e.g. "compact") so an
  // individual media block can be sized down without affecting every other
  // comparison/gallery/diagram in the Learning Hub.
  const widthClass = media.width_treatment ? ` learning-media--${escapeHtmlText(media.width_treatment)}` : "";

  return [
    `<figure class="learning-media learning-media--${escapeHtmlText(media.layout)}${widthClass}">`,
    body,
    media.overall_caption ? `<figcaption>${escapeHtmlText(media.overall_caption)}</figcaption>` : "",
    "</figure>"
  ].join("");
}

function markdownBodyToHtml(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];
  let listType = null;
  let listStart = null;
  let actionBlocks = [];

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
      const startStyle = listStart && listStart > 1 ? ` style="--learning-rule-start: ${listStart};"` : "";
      blocks.push(`<ol class="learning-rule-list"${startStyle}>\n          ${items}\n        </ol>`);
    } else {
      const tag = listType === "ordered" ? "ol" : "ul";
      const startAttr = listType === "ordered" && listStart && listStart > 1 ? ` start="${listStart}"` : "";
      const items = listItems.map((item) => `<li>${inlineHtml(item.main)}</li>`).join("\n          ");
      blocks.push(`<${tag}${startAttr}>\n          ${items}\n        </${tag}>`);
    }

    listItems = [];
    listType = null;
    listStart = null;
  };

  const flushActions = () => {
    if (!actionBlocks.length) return;
    blocks.push(
      actionBlocks.length > 1
        ? `<div class="learning-action-choice-group">${actionBlocks.join("")}</div>`
        : actionBlocks[0]
    );
    actionBlocks = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const contentMarker = parseContentMarker(line);
    if (contentMarker) {
      flushParagraph();
      flushList();
      actionBlocks.push(contentMarkerHtml(contentMarker.kind, contentMarker.rawLabel));
      continue;
    }

    const mediaMarker = parseMediaMarker(line);
    if (mediaMarker) {
      flushParagraph();
      flushList();
      flushActions();
      blocks.push(mediaMarkerHtml(mediaMarker.rawKey));
      continue;
    }

    const headingMatch = /^(#{2,4})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushActions();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${inlineHtml(headingMatch[2])}</h${level}>`);
      continue;
    }

    const orderedMatch = /^(\d+)\.\s+(.+)$/.exec(line);
    if (orderedMatch) {
      flushParagraph();
      flushActions();
      if (listType && listType !== "ordered") flushList();
      listType = "ordered";
      if (!listItems.length) listStart = Number(orderedMatch[1]);
      listItems.push({ main: orderedMatch[2], continuation: null });
      continue;
    }

    const unorderedMatch = /^[-*]\s+(.+)$/.exec(line);
    if (unorderedMatch) {
      flushParagraph();
      flushActions();
      if (listType && listType !== "unordered") flushList();
      listType = "unordered";
      if (!listItems.length) listStart = null;
      listItems.push({ main: unorderedMatch[1], continuation: null });
      continue;
    }

    if (/^\s{2,}\S/.test(rawLine) && listItems.length) {
      listItems[listItems.length - 1].continuation = line;
      continue;
    }

    flushList();
    flushActions();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  flushActions();

  return `\n        ${blocks.join("\n        ")}\n      `;
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
    knowledge_check: { questions: fields.knowledge_check?.questions ?? [] },
    instructor_tips: bulletArray(fields.instructor_tips),
    common_mistakes: bulletArray(fields.common_mistakes),
    // Safety Notes is written as prose in every currently-normalized lesson,
    // not a bullet list -- bulletArray() would silently return [] and hide
    // the panel entirely, even though the real Shopify/Liquid render (which
    // just runs the rich_text_field through metafield_tag) shows it fine.
    // Reuse the same markdown-to-HTML conversion already used for
    // lesson_body so prose renders as prose and a list (if a lesson ever
    // legitimately writes one) renders as a list, matching production
    // either way instead of forcing a bullet-only convention onto this field.
    safety_notes_html: markdownBodyToHtml(fields.safety_notes),
    key_takeaways: fields.key_takeaways || [],
    related_lessons: fields.related_lessons || [],
    related_tools: fields.related_tools || [],
    related_products: fields.related_products || [],
    downloadable_resources: fields.downloadable_resources || [],
    primary_cta: fields.primary_cta || null
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
  lines.push(`  safety_notes_html: \`${fixture.safety_notes_html}\`,`);
  lines.push(`  key_takeaways: [\n${fixture.key_takeaways.map((t) => `    ${JSON.stringify(t)}`).join(",\n")}\n  ],`);
  lines.push(`  related_lessons: ${JSON.stringify(fixture.related_lessons)},`);
  lines.push(`  related_tools: ${JSON.stringify(fixture.related_tools)},`);
  lines.push(`  related_products: ${JSON.stringify(fixture.related_products)},`);
  lines.push(`  downloadable_resources: ${JSON.stringify(fixture.downloadable_resources)},`);
  lines.push(`  primary_cta: ${JSON.stringify(fixture.primary_cta)}`);
  lines.push("}");
  return lines.join("\n");
}

function serializeStringArray(values, indent) {
  return `[\n${values.map((v) => `${" ".repeat(indent)}${JSON.stringify(v)}`).join(",\n")}\n${" ".repeat(indent - 2)}]`;
}

const categories = loadCategories();
const relatedLessonIndex = readRelatedLessonIndex();
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

const relatedLessonIndexBlock = relatedLessonIndex
  .map(
    (lesson) =>
      `    {\n      handle: '${lesson.handle}',\n      title: ${JSON.stringify(lesson.title)},\n      short_description: ${JSON.stringify(lesson.short_description)}\n    }`
  )
  .join(",\n");

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
//   - Related lesson preview targets: approved lesson index plus local
//     content-development/lessons/*/public-copy.md where present.
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
    whyProofPoints: ${serializeStringArray(HOMEPAGE.whyProofPoints, 6)},
    whyImage: ${JSON.stringify(HOMEPAGE.whyImage)},
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
  relatedLessonIndex: [
${relatedLessonIndexBlock}
  ],
  lessons: [
${lessonsBlock}
  ]
};
`;

const contentHash = crypto.createHash("md5").update(output).digest("hex").slice(0, 12);
const hashedAssetFilename = `learning-hub-preview-data.${contentHash}.js`;
const hashedAssetPath = path.join(ASSETS_DIR, hashedAssetFilename);

// Remove any previously-generated hashed copies so they don't accumulate
// forever -- safe because the only reference to this filename is the pointer
// snippet regenerated right below, which always points at the current hash.
for (const file of fs.readdirSync(ASSETS_DIR)) {
  if (/^learning-hub-preview-data\.[0-9a-f]{12}\.js$/.test(file) && file !== hashedAssetFilename) {
    fs.unlinkSync(path.join(ASSETS_DIR, file));
  }
}

fs.writeFileSync(hashedAssetPath, output);
console.log(`Generated ${path.relative(REPO_ROOT, hashedAssetPath)}`);

fs.writeFileSync(
  SCRIPT_TAG_SNIPPET_PATH,
  `{% comment %} GENERATED FILE -- DO NOT EDIT BY HAND. Regenerate with: npm run learning:generate-preview-fixture (from shopify/) {% endcomment %}\n<script src="{{ '${hashedAssetFilename}' | asset_url }}" defer></script>\n`
);
console.log(`Generated ${path.relative(REPO_ROOT, SCRIPT_TAG_SNIPPET_PATH)} -> ${hashedAssetFilename}`);

const mediaOutputPath = path.join(REPO_ROOT, "theme/learning-hub-pilot/assets/learning-hub-media-data.js");
const mediaOutput = `// GENERATED FILE -- DO NOT EDIT BY HAND.
// Regenerate with: npm run learning:generate-preview-fixture (from shopify/)
// Source: content-development/media/learning-media.json
window.OOLearningHubMediaRegistry = ${JSON.stringify(stripInternalFields(mediaRegistry), null, 2)};
`;

fs.writeFileSync(mediaOutputPath, mediaOutput);
console.log(`Generated ${path.relative(REPO_ROOT, mediaOutputPath)}`);

// Production Knowledge Check data, keyed by lesson handle (never by internal
// lesson_id -- the handle is already public in the page URL, the ID is not).
// Consumed by learning-hub-knowledge-check.js on the real lesson template.
// Question wording/options/answers/explanations come straight from each
// lesson's parsed "## Knowledge Check" section (shopify/data/lessons/*.json
// `knowledge_check` field) -- this file only reshapes that data, it never
// edits it.
const knowledgeCheckOutputPath = path.join(REPO_ROOT, "theme/learning-hub-pilot/assets/learning-hub-knowledge-check-data.js");
const knowledgeCheckByHandle = {};
for (const lesson of loadLessons()) {
  const questions = lesson.fields.knowledge_check?.questions ?? [];
  if (questions.length) knowledgeCheckByHandle[lesson.handle] = { questions };
}
const knowledgeCheckOutput = `// GENERATED FILE -- DO NOT EDIT BY HAND.
// Regenerate with: npm run learning:generate-preview-fixture (from shopify/)
// Source: each lesson's "## Knowledge Check" section in
// content-development/lessons/*/public-copy.md, parsed into
// shopify/data/lessons/*.json's \`knowledge_check\` field by
// shopify/scripts/generate-pilot-data.js. Edit public-copy.md, not this file.
window.OOLearningHubKnowledgeCheckData = ${JSON.stringify(knowledgeCheckByHandle, null, 2)};
`;

fs.writeFileSync(knowledgeCheckOutputPath, knowledgeCheckOutput);
console.log(`Generated ${path.relative(REPO_ROOT, knowledgeCheckOutputPath)}`);

// Production "Lesson X of Y" + Previous/Next navigation data, keyed by
// lesson handle. Scoped to shopify/data/public-launch-lessons.json (the same
// launch-scope gate lessonUrlFromHandle() uses) so a lesson never gets a
// position number relative to unpublished siblings, and never links to a
// DRAFT lesson as its previous/next.
//
// Ordered within each category by `lesson_id` (R01, R02, ... -- the
// original editorial authoring sequence): there is no dedicated
// per-category position field on `learning_lesson`, and
// learning-category.liquid's own `metaobjects.learning_lesson.values` loop
// has no defined sort order (an unspecified Shopify connection order), so
// it is not a usable source of truth for a customer-facing lesson number.
// lesson_id is already required on every lesson and is stable/sequential
// within a category by construction (confirmed against the current 23
// launch lessons: gear-masks-vision -> 7, safety-conditions -> 10,
// in-water-skills -> 6, matching editorial expectations exactly).
const launchHandles = loadPublicLaunchLessonHandles();
const categoryTitleByHandle = new Map(categories.map((category) => [category.handle, category.fields.title]));
const launchLessonsByCategory = new Map();
for (const lesson of loadLessons()) {
  if (!launchHandles.has(lesson.handle)) continue;
  const categoryHandle = lesson.fields.category;
  if (!categoryHandle) continue;
  if (!launchLessonsByCategory.has(categoryHandle)) launchLessonsByCategory.set(categoryHandle, []);
  launchLessonsByCategory.get(categoryHandle).push(lesson);
}

const lessonPositionByHandle = {};
for (const [categoryHandle, categoryLessons] of launchLessonsByCategory) {
  categoryLessons.sort((a, b) => {
    const numA = parseInt(String(a.fields.lesson_id).replace(/\D/g, ""), 10);
    const numB = parseInt(String(b.fields.lesson_id).replace(/\D/g, ""), 10);
    return numA - numB;
  });

  categoryLessons.forEach((lesson, i) => {
    const position = i + 1;
    const previous = categoryLessons[i - 1] || null;
    const next = categoryLessons[i + 1] || null;

    lessonPositionByHandle[lesson.handle] = {
      category_handle: categoryHandle,
      category_title: categoryTitleByHandle.get(categoryHandle) || null,
      index: position,
      total: categoryLessons.length,
      previous: previous ? { handle: previous.handle, title: previous.fields.title, index: position - 1 } : null,
      next: next ? { handle: next.handle, title: next.fields.title, index: position + 1 } : null
    };
  });
}

const lessonPositionOutputPath = path.join(REPO_ROOT, "theme/learning-hub-pilot/assets/learning-hub-lesson-position-data.js");
const lessonPositionOutput = `// GENERATED FILE -- DO NOT EDIT BY HAND.
// Regenerate with: npm run learning:generate-preview-fixture (from shopify/)
// Source: shopify/data/lessons/*.json, filtered to
// shopify/data/public-launch-lessons.json and ordered within each category
// by lesson_id. Consumed by learning-hub-lesson-position.js on the
// production lesson template for the "Lesson X of Y" chip and the
// Previous/Next lesson navigation.
window.OOLearningHubLessonPositionData = ${JSON.stringify(lessonPositionByHandle, null, 2)};
`;

fs.writeFileSync(lessonPositionOutputPath, lessonPositionOutput);
console.log(`Generated ${path.relative(REPO_ROOT, lessonPositionOutputPath)}`);
