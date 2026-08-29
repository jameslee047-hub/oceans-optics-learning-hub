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
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .trim();
}

function textNode(value) {
  return { type: "text", value: normalizeInline(value) };
}

function paragraph(value) {
  return { type: "paragraph", children: [textNode(value)] };
}

function heading(value, level) {
  return { type: "heading", level, children: [textNode(value)] };
}

function listBlock(items, listType) {
  return {
    type: "list",
    listType,
    children: items.map((item) => ({
      type: "list-item",
      children: [textNode(item)]
    }))
  };
}

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

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{2,4})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      children.push(heading(headingMatch[2], headingMatch[1].length));
      continue;
    }

    const orderedMatch = /^(\d+)\.\s+(.+)$/.exec(line);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ordered") flushList();
      listType = "ordered";
      listItems.push(orderedMatch[2]);
      continue;
    }

    const unorderedMatch = /^[-*]\s+(.+)$/.exec(line);
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
