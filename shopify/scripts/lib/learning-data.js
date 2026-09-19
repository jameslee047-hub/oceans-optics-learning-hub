import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SHOPIFY_ROOT = path.resolve(__dirname, "..", "..");
export const REPO_ROOT = path.resolve(SHOPIFY_ROOT, "..");
export const GENERATED_DIR = path.join(SHOPIFY_ROOT, "generated");

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(SHOPIFY_ROOT, relativePath), "utf8"));
}

export function writeJson(relativePath, data) {
  const target = path.join(SHOPIFY_ROOT, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
}

export function loadDefinitions() {
  return readJson("schema/definitions.json").definitions;
}

export function loadCategories() {
  return readJson("data/categories.json");
}

export function loadPathways() {
  return readJson("data/pathways.json");
}

export function loadApprovedLessons() {
  return readJson("data/approved-lesson-handles.json");
}

// The launch-scope gate for [Title](lesson:handle) links: a handle not in this
// list renders as plain text (no href) rather than a link to an unpublished
// page. Add a handle here only once that lesson joins an approved public
// launch batch -- source markdown does not need to change when it does, since
// the same link automatically goes live the next time data is regenerated.
let publicLaunchLessonHandlesCache = null;

export function loadPublicLaunchLessonHandles() {
  if (publicLaunchLessonHandlesCache) return publicLaunchLessonHandlesCache;
  const target = path.join(SHOPIFY_ROOT, "data", "public-launch-lessons.json");
  if (!fs.existsSync(target)) {
    publicLaunchLessonHandlesCache = new Set();
    return publicLaunchLessonHandlesCache;
  }
  const { handles } = JSON.parse(fs.readFileSync(target, "utf8"));
  publicLaunchLessonHandlesCache = new Set(handles ?? []);
  return publicLaunchLessonHandlesCache;
}

export function loadLessons() {
  const lessonDir = path.join(SHOPIFY_ROOT, "data", "lessons");
  if (!fs.existsSync(lessonDir)) return [];
  return fs
    .readdirSync(lessonDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(lessonDir, file), "utf8")));
}

export function isAppReservedMetaobjectType(type) {
  return String(type || "").startsWith("$app:");
}

export function buildDefinitionAccess(definition) {
  const access = definition.access || {};

  if (access.admin && !isAppReservedMetaobjectType(definition.type)) {
    throw new Error(`Merchant-owned metaobject definition ${definition.type} must not specify access.admin; merchant/Admin access is inherent.`);
  }

  const output = {};
  if (access.admin) output.admin = access.admin;
  if (access.storefront) output.storefront = access.storefront;

  return Object.keys(output).length ? output : undefined;
}

export function normalizeInline(text) {
  return String(text ?? "")
    .replace(/\bR\d{2}\s+(?=[A-Z])/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .trim();
}

const LESSON_LINK_PATTERN = /\[([^\]]+)\]\(lesson:([a-z0-9-]+)\)/g;

function lessonUrlFromHandle(handle) {
  if (!loadPublicLaunchLessonHandles().has(handle)) return null;
  const lesson = loadApprovedLessons().find((entry) => entry.handle === handle)
    || loadLessons().find((entry) => entry.handle === handle);
  return lesson ? `/pages/learn/${lesson.handle}` : null;
}

function contentMarkerKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function labelFromHandle(handle) {
  return handle.replace(/-/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export const CONTENT_MARKER_DESTINATIONS = {
  TOOL: {
    "mask-sizing-tool": {
      label: "Use the Mask Sizing Tool",
      url: "/pages/how-to-check-if-a-mask-will-fit-you-online"
    },
    "lens-calculator": {
      label: "Calculate Your Lenses",
      url: "/pages/prescription-lenses-calculator-tool"
    },
    "underwater-lens-calculator": {
      label: "Calculate Your Lenses",
      url: "/pages/prescription-lenses-calculator-tool"
    }
  },
  PRODUCT: {
    "prescription-mask-collection": {
      label: "Shop Prescription Masks",
      url: "https://oceansoptics.com/collections/all-our-masks"
    }
  },
  CTA: {
    "contact-us": {
      label: "Contact Us",
      url: "/pages/contact-us"
    },
    "find-your-mask": {
      label: "Find Your Perfect Mask",
      url: "https://quiz.oceansoptics.com/quiz?utm_source=learning_hub&utm_medium=lesson_cta&utm_campaign=choosing_a_mask&utm_content=find_your_perfect_mask"
    },
    "find-your-perfect-mask": {
      label: "Find Your Perfect Mask",
      url: "https://quiz.oceansoptics.com/quiz"
    }
  }
};

export const DOWNLOAD_DESTINATIONS = {
  // Already live on Shopify (attached to R10's downloadable_resources via
  // sync-safety-conditions-media.js, 2026-09-07) -- file_gid/url backfilled
  // here from a direct Admin API read so local generation (and the dev
  // fixture preview, which has no access to live Shopify data) stops
  // treating this as an unresolved download. Do not re-upload; this is the
  // existing approved PDF.
  "pre-snorkel-checklist": {
    label: "Pre-Snorkel Checklist",
    url: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/pre_snorkel_checklist.pdf?v=1789556434",
    asset_filename: "pre_snorkel_checklist.pdf",
    drive_file_id: "1rXOIzQ6eFT0WsIdmCSMqoRq3Nz4Qf7Mk",
    gid: null,
    file_gid: "gid://shopify/GenericFile/64735134646605"
  }
};

export function parseContentMarker(line) {
  const match = /^\[(TOOL|PRODUCT|CTA):\s*([^\]]+)\]$/.exec(String(line ?? "").trim());
  if (!match) return null;

  return {
    kind: match[1],
    rawLabel: match[2].trim()
  };
}

export function resolveContentMarker(kind, rawLabel) {
  const normalizedKind = String(kind ?? "").toUpperCase();
  const key = contentMarkerKey(rawLabel);
  const destination = CONTENT_MARKER_DESTINATIONS[normalizedKind]?.[key];

  return {
    kind: normalizedKind,
    handle: key,
    label: destination?.label ?? normalizeInline(rawLabel),
    url: destination?.url ?? null,
    gid: null,
    file_gid: null
  };
}

export function resolveDownloadMarker(rawLabel) {
  const handle = contentMarkerKey(rawLabel);
  const destination = DOWNLOAD_DESTINATIONS[handle];

  return {
    handle,
    label: destination?.label ?? labelFromHandle(handle),
    url: destination?.url ?? null,
    asset_filename: destination?.asset_filename ?? null,
    drive_file_id: destination?.drive_file_id ?? null,
    gid: destination?.gid ?? null,
    file_gid: destination?.file_gid ?? null
  };
}

// Canonical directive is [MEDIA: key]. A Learning Media block may hold a static
// image, an image comparison, a diagram, an animated GIF, a looping video, or an
// ordered gallery -- the source copy only names a stable key, never a file type.
export const LEARNING_MEDIA_LAYOUTS = new Set(["standard", "comparison", "diagram", "animated", "gallery"]);
export const LEARNING_MEDIA_ITEM_TYPES = new Set(["image", "animated", "video"]);

export function parseMediaMarker(line) {
  const match = /^\[MEDIA:\s*([^\]]+)\]$/.exec(String(line ?? "").trim());
  if (!match) return null;

  return {
    kind: "MEDIA",
    rawKey: match[1].trim(),
    key: contentMarkerKey(match[1])
  };
}

// content-development/media/learning-media.json is a LOCAL DEVELOPMENT FIXTURE /
// FALLBACK ONLY. It is not canonical production authoring. Once Shopify
// `learning_media` metaobjects exist (attached to a lesson and matched by
// media_key), those records become the source of truth and this registry is
// only a stand-in for local preview of lessons that don't have one yet.
export function loadLearningMediaRegistry() {
  const registryPath = path.join(REPO_ROOT, "content-development", "media", "learning-media.json");
  if (!fs.existsSync(registryPath)) {
    return { schema_version: 1, media: {} };
  }

  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
}

function normalizeMediaItem(item = {}) {
  return {
    label: item.label ?? null,
    alt: item.alt ?? item.alt_text ?? null,
    url: item.url ?? item.image_url ?? null,
    asset_filename: item.asset_filename ?? null,
    gid: item.gid ?? item.shopify_file_gid ?? item.file_gid ?? null,
    width: item.width ?? null,
    height: item.height ?? null,
    aspect_ratio: item.aspect_ratio ?? null,
    media_type: item.media_type ?? item.type ?? "image",
    caption: item.caption ?? null,
    credit_source: item.credit_source ?? item.credit ?? null
  };
}

export function resolveLearningMediaMarker(rawKey, registry = loadLearningMediaRegistry()) {
  const key = contentMarkerKey(rawKey);
  const record = registry.media?.[key] ?? null;
  if (!record) {
    return { key, rawKey, resolved: false, layout: null, overall_caption: null, items: [] };
  }

  const layout = record.layout || record.type || "standard";
  const items = Array.isArray(record.items)
    ? record.items.map(normalizeMediaItem)
    : Array.isArray(record.images)
      ? record.images.map(normalizeMediaItem)
      : [normalizeMediaItem(record)];

  return {
    key,
    rawKey,
    resolved: true,
    layout,
    width_treatment: record.width_treatment ?? null,
    overall_caption: record.overall_caption ?? record.caption ?? null,
    items
  };
}

function textNode(value) {
  return { type: "text", value: normalizeInline(value) };
}

function normalizeInlineSegment(text) {
  return String(text ?? "")
    .replace(/\bR\d{2}\s+(?=[A-Z])/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
}

function textSegmentNode(value) {
  return { type: "text", value: normalizeInlineSegment(value) };
}

function richTextInlineNodes(value) {
  const raw = String(value ?? "");
  const nodes = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(LESSON_LINK_PATTERN)) {
    if (match.index > lastIndex) {
      nodes.push(textSegmentNode(raw.slice(lastIndex, match.index)));
    }

    const url = lessonUrlFromHandle(match[2]);
    if (url) {
      nodes.push({
        type: "link",
        url,
        children: [textNode(match[1])]
      });
    } else {
      nodes.push(textNode(match[1]));
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    nodes.push(textSegmentNode(raw.slice(lastIndex)));
  }

  return nodes.length ? nodes.filter((node) => node.value !== "") : [textNode(raw)];
}

function paragraph(value) {
  return { type: "paragraph", children: richTextInlineNodes(value) };
}

function linkParagraph(link) {
  return {
    type: "paragraph",
    children: [
      {
        type: "link",
        url: link.url,
        children: [textNode(link.label)]
      }
    ]
  };
}

function heading(value, level) {
  return { type: "heading", level, children: richTextInlineNodes(value) };
}

function listBlock(items, listType) {
  return {
    type: "list",
    listType,
    children: items.map((item) => ({
      type: "list-item",
      children: richTextInlineNodes(item)
    }))
  };
}

const ORDERED_ITEM_PATTERN = /^(\d+)\.\s+(.+)$/;
const UNORDERED_ITEM_PATTERN = /^[-*]\s+(.+)$/;

export function markdownToShopifyRichText(markdown) {
  const children = [];
  const lines = String(markdown ?? "").split(/\r?\n/);
  let paragraphLines = [];
  let listItems = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    children.push(paragraph(paragraphLines.join(" ")));
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    children.push(listBlock(listItems, listType));
    listItems = [];
    listType = null;
  };

  // A blank line between two Markdown list items of the same type (a
  // "loose" list -- e.g. each numbered step given its own paragraph for
  // readability) is not a list boundary; only a blank line followed by
  // something other than a continuing item of the current list type ends
  // the list. Without this lookahead, every blank-line-separated item
  // became its own single-item <ol>/<ul>, and every <ol> restarts its
  // numbering at 1 (confirmed: this is what produced the "1. 1. 1. 1."
  // rendering bug on Choosing a Mask's "A Practical Mask Shortlist").
  const nextSignificantLineType = (fromIndex) => {
    for (let j = fromIndex; j < lines.length; j += 1) {
      const trimmed = lines[j].trim();
      if (!trimmed) continue;
      if (ORDERED_ITEM_PATTERN.test(trimmed)) return "ordered";
      if (UNORDERED_ITEM_PATTERN.test(trimmed)) return "unordered";
      return null;
    }
    return null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      if (listType && nextSignificantLineType(i + 1) === listType) continue;
      flushList();
      continue;
    }

    const contentMarker = parseContentMarker(line);
    if (contentMarker) {
      flushParagraph();
      flushList();
      const link = resolveContentMarker(contentMarker.kind, contentMarker.rawLabel);
      if (link.url) children.push(linkParagraph(link));
      continue;
    }

    const headingMatch = /^(#{2,4})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      children.push(heading(headingMatch[2], headingMatch[1].length));
      continue;
    }

    const orderedMatch = ORDERED_ITEM_PATTERN.exec(line);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ordered") flushList();
      listType = "ordered";
      listItems.push(orderedMatch[2]);
      continue;
    }

    const unorderedMatch = UNORDERED_ITEM_PATTERN.exec(line);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "unordered") flushList();
      listType = "unordered";
      listItems.push(unorderedMatch[1]);
      continue;
    }

    if (/^\s{2,}\S/.test(rawLine) && listItems.length) {
      listItems[listItems.length - 1] += ` ${line}`;
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return { type: "root", children };
}

// Parses a "## Knowledge Check" section's markdown (already extracted by the
// caller) into structured {question, answers, correct_index, explanation}
// records. Shared by generate-pilot-data.js (which stores the parsed result
// as a local-only field, never sent to Shopify -- there is no schema field
// for it) and generate-preview-fixture.js / the production knowledge-check
// data file, so question wording/options/answers/explanations are parsed
// identically everywhere from the same canonical source.
export function parseKnowledgeCheckQuestions(markdown) {
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

    const qMatch = /^(?:\*\*)?Q\d+\.\s+(.+?)(?:\*\*)?$/.exec(line);
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

    const correctMatch = /^(?:\*\*)?Correct:(?:\*\*)?\s*([A-Z])$/.exec(line);
    if (correctMatch && current) {
      current.correctLetter = correctMatch[1];
      continue;
    }

    const explanationMatch = /^(?:\*\*)?Explanation:(?:\*\*)?\s*(.+)$/.exec(line);
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

export function gidToken(kind, type, handle) {
  return `__RESOLVE_${kind.toUpperCase()}__:${type}:${handle}`;
}

export function linkValue(link) {
  if (!link || !link.url) return null;
  return JSON.stringify({ url: link.url, text: link.label || link.text || link.url });
}

export function fieldPayloadValue(fieldType, value, fieldDefinition) {
  if (value === undefined || value === null) return null;

  switch (fieldType) {
    case "single_line_text_field":
    case "multi_line_text_field":
    case "date":
      return String(value);
    case "number_integer":
      return String(value);
    case "rich_text_field":
      return JSON.stringify(markdownToShopifyRichText(value));
    case "file_reference":
      if (typeof value === "string") return value;
      return value.gid ?? null;
    case "metaobject_reference":
      if (typeof value === "string") {
        return gidToken("metaobject", fieldDefinition.referenceTarget, value);
      }
      return value.gid ?? gidToken("metaobject", fieldDefinition.referenceTarget, value.handle);
    case "list.single_line_text_field":
      return JSON.stringify(value);
    case "list.metaobject_reference":
      return JSON.stringify(
        value.map((entry) => {
          if (typeof entry === "string") return gidToken("metaobject", fieldDefinition.referenceTarget, entry);
          return entry.gid ?? gidToken("metaobject", fieldDefinition.referenceTarget, entry.handle);
        })
      );
    case "list.product_reference":
      {
        const resolved = value.filter((entry) => entry.gid).map((entry) => entry.gid);
        return resolved.length ? JSON.stringify(resolved) : null;
      }
    case "list.file_reference":
      {
        const resolved = value.filter((entry) => entry.gid || entry.file_gid).map((entry) => entry.gid ?? entry.file_gid);
        return resolved.length ? JSON.stringify(resolved) : null;
      }
    case "list.link":
      {
        const resolved = value.filter((entry) => entry.url).map((entry) => ({ url: entry.url, text: entry.label || entry.url }));
        return resolved.length ? JSON.stringify(resolved) : null;
      }
    case "link":
      return linkValue(value);
    default:
      return String(value);
  }
}

export function buildUpsertPayload(entry, definition) {
  const fields = [];
  const fieldDefinitions = new Map(definition.fields.map((field) => [field.key, field]));

  for (const field of definition.fields) {
    const value = entry.fields[field.key];
    const payloadValue = fieldPayloadValue(field.type, value, field);
    if (payloadValue !== null && payloadValue !== undefined && payloadValue !== "") {
      fields.push({ key: field.key, value: payloadValue });
    }
  }

  return {
    operation: "metaobjectUpsert",
    variables: {
      handle: {
        type: entry.type,
        handle: entry.handle
      },
      metaobject: {
        capabilities: {
          publishable: {
            status: entry.publication_status || "DRAFT"
          }
        },
        fields
      }
    },
    semantics: "Uses the metaobject input form. Provided fields are updated; omitted fields are preserved on existing records.",
    managedFieldKeys: [...fieldDefinitions.keys()]
  };
}

export function buildDefinitionPayload(definition) {
  const definitionInput = {
    type: definition.type,
    name: definition.name,
    capabilities: definition.capabilities,
    fieldDefinitions: definition.fields.map((field) => {
      const output = {
        key: field.key,
        name: field.name,
        type: field.type,
        required: Boolean(field.required)
      };
      if (field.referenceTarget) {
        output.validations = [
          {
            name: "metaobject_definition_type",
            value: field.referenceTarget
          }
        ];
      }
      return output;
    })
  };
  const access = buildDefinitionAccess(definition);
  if (access) definitionInput.access = access;

  return {
    operation: "metaobjectDefinitionCreate",
    variables: {
      definition: definitionInput
    },
    note: "Local payload skeleton only. Definition mutations are not executed in Stage 5A."
  };
}
