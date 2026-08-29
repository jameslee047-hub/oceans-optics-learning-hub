import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  loadApprovedLessons,
  loadCategories,
  loadDefinitions,
  loadLessons,
  loadPathways,
  writeJson
} from "./lib/learning-data.js";

const forbiddenMarkers = [
  "[CONTENT GAP]",
  "[INSTRUCTOR INPUT OPPORTUNITY]",
  "[SAFETY REVIEW REQUIRED]",
  "[CURRENT GUIDANCE CHECK REQUIRED]",
  "[FACT CHECK]",
  "Codex draft",
  "source IDs",
  "source files",
  "source confidence",
  "extracted-content",
  "Genially",
  "publication readiness",
  "review tags"
];

const britishTerms = [
  "snorkelling",
  "snorkeller",
  "equalising",
  "behaviour",
  "recognise",
  "recognising",
  "recognised",
  "colour",
  "signalling",
  "organise",
  "traveller"
];

const shopifyOnlyForbiddenFieldKeys = [
  "source_ids",
  "source_files",
  "source_confidence",
  "content_gaps",
  "instructor_input_opportunities",
  "fact_check_requirements",
  "safety_review_requirements",
  "current_guidance_requirements",
  "omitted_content",
  "duplicate_consolidation_notes",
  "visual_brief",
  "review_tags",
  "publication_readiness",
  "pathways"
];

const materialReviewRequired = new Map([
  ["R08", "safety/current-guidance review"],
  ["R12", "safety/current-guidance review"]
]);

function issue(severity, code, target, message, detail = undefined) {
  return { severity, code, target, message, ...(detail === undefined ? {} : { detail }) };
}

function walkStrings(value, visitor, location = "") {
  if (typeof value === "string") {
    visitor(value, location);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visitor, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      walkStrings(child, visitor, location ? `${location}.${key}` : key);
    }
  }
}

function isEmpty(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function checkRequiredFields(entries, definition, messages) {
  const requiredFields = definition.fields.filter((field) => field.required);
  for (const entry of entries) {
    for (const field of requiredFields) {
      if (isEmpty(entry.fields?.[field.key])) {
        messages.push(issue("ERROR", "REQUIRED_FIELD_MISSING", `${entry.type}:${entry.handle}`, `Missing required field ${field.key}.`));
      }
    }
  }
}

function checkUnique(entries, selector, code, label, messages) {
  const seen = new Map();
  for (const entry of entries) {
    const value = selector(entry);
    if (!value) continue;
    if (seen.has(value)) {
      messages.push(issue("ERROR", code, value, `Duplicate ${label}: ${value}.`, [seen.get(value), entry.handle]));
    } else {
      seen.set(value, entry.handle);
    }
  }
}

function checkPublicStrings(entries, messages) {
  for (const entry of entries) {
    walkStrings(entry.fields, (value, location) => {
      for (const marker of forbiddenMarkers) {
        if (value.toLowerCase().includes(marker.toLowerCase())) {
          messages.push(issue("ERROR", "FORBIDDEN_INTERNAL_MARKER", `${entry.type}:${entry.handle}:${location}`, `Public Shopify data contains forbidden internal marker: ${marker}.`));
        }
      }

      for (const term of britishTerms) {
        const pattern = new RegExp(`\\b${term}\\b`, "i");
        if (pattern.test(value)) {
          messages.push(issue("WARNING", "US_ENGLISH_TERM", `${entry.type}:${entry.handle}:${location}`, `Use US English instead of "${term}".`));
        }
      }

      if (/\[(TOOL|PRODUCT|DOWNLOAD|CTA):/i.test(value)) {
        messages.push(issue("ERROR", "RAW_PLACEHOLDER_IN_PUBLIC_FIELD", `${entry.type}:${entry.handle}:${location}`, "Raw structured placeholder found in public Shopify field."));
      }
    });
  }
}

function checkForbiddenFieldKeys(lessons, messages) {
  for (const lesson of lessons) {
    for (const key of shopifyOnlyForbiddenFieldKeys) {
      if (Object.hasOwn(lesson.fields, key)) {
        messages.push(issue("ERROR", "FORBIDDEN_SHOPIFY_FIELD", `${lesson.type}:${lesson.handle}`, `Repository-only field ${key} must not be present in Shopify-normalized data.`));
      }
    }
  }
}

function checkLocalAsset(value, target, messages) {
  if (!value) return;
  const localPath = typeof value === "string" ? value : value.local_path;
  if (!localPath) return;
  const absolutePath = path.resolve(REPO_ROOT, localPath);
  if (!fs.existsSync(absolutePath)) {
    messages.push(issue("ERROR", "BROKEN_LOCAL_ASSET_REFERENCE", target, `Local asset does not exist: ${localPath}.`));
  }
}

export function runValidation() {
  const definitions = loadDefinitions();
  const definitionByType = new Map(definitions.map((definition) => [definition.type, definition]));
  const categories = loadCategories();
  const pathways = loadPathways();
  const lessons = loadLessons();
  const approvedLessons = loadApprovedLessons();
  const approvedHandleSet = new Set(approvedLessons.map((lesson) => lesson.handle));
  const lessonHandleSet = new Set(lessons.map((lesson) => lesson.handle));
  const categoryHandleSet = new Set(categories.map((category) => category.handle));
  const messages = [];

  checkRequiredFields(lessons, definitionByType.get("learning_lesson"), messages);
  checkRequiredFields(categories, definitionByType.get("learning_category"), messages);
  checkRequiredFields(pathways, definitionByType.get("learning_pathway"), messages);

  checkUnique(lessons, (entry) => entry.handle, "DUPLICATE_LESSON_HANDLE", "lesson handle", messages);
  checkUnique(lessons, (entry) => entry.fields.lesson_id, "DUPLICATE_LESSON_ID", "lesson ID", messages);
  checkUnique(categories, (entry) => entry.handle, "DUPLICATE_CATEGORY_HANDLE", "category handle", messages);
  checkUnique(pathways, (entry) => entry.handle, "DUPLICATE_PATHWAY_HANDLE", "pathway handle", messages);

  checkPublicStrings([...lessons, ...categories, ...pathways], messages);
  checkForbiddenFieldKeys(lessons, messages);

  for (const lesson of lessons) {
    if (!categoryHandleSet.has(lesson.fields.category)) {
      messages.push(issue("ERROR", "INVALID_CATEGORY_HANDLE", `${lesson.type}:${lesson.handle}`, `Unknown category handle: ${lesson.fields.category}.`));
    }

    if (materialReviewRequired.has(lesson.fields.lesson_id) && !lesson.fields.reviewer) {
      const severity = lesson.publication_status === "ACTIVE" ? "ERROR" : "WARNING";
      messages.push(issue(severity, "MISSING_HUMAN_REVIEWER", `${lesson.type}:${lesson.handle}`, `${lesson.fields.lesson_id} requires ${materialReviewRequired.get(lesson.fields.lesson_id)} before ACTIVE publication.`));
    }

    if (materialReviewRequired.has(lesson.fields.lesson_id) && !lesson.fields.last_reviewed) {
      const severity = lesson.publication_status === "ACTIVE" ? "ERROR" : "WARNING";
      messages.push(issue(severity, "MISSING_LAST_REVIEWED", `${lesson.type}:${lesson.handle}`, `${lesson.fields.lesson_id} requires last_reviewed before ACTIVE publication.`));
    }

    checkLocalAsset(lesson.fields.hero_media, `${lesson.type}:${lesson.handle}:hero_media`, messages);

    for (const related of lesson.fields.related_lessons ?? []) {
      if (!approvedHandleSet.has(related.handle)) {
        messages.push(issue("ERROR", "INVALID_RELATED_LESSON_HANDLE", `${lesson.type}:${lesson.handle}`, `Related lesson handle is not in the approved lesson index: ${related.handle}.`));
      } else if (!lessonHandleSet.has(related.handle)) {
        messages.push(issue("WARNING", "UNRESOLVED_RELATED_LESSON_HANDLE", `${lesson.type}:${lesson.handle}`, `Related lesson ${related.lesson_id || related.handle} is approved but not normalized yet.`));
      }
    }

    for (const tool of lesson.fields.related_tools ?? []) {
      if (!tool.url) {
        messages.push(issue("WARNING", "UNRESOLVED_TOOL_REFERENCE", `${lesson.type}:${lesson.handle}`, `Tool reference has no public URL yet: ${tool.handle}.`));
      }
    }

    for (const product of lesson.fields.related_products ?? []) {
      if (!product.gid) {
        messages.push(issue("WARNING", "UNRESOLVED_PRODUCT_REFERENCE", `${lesson.type}:${lesson.handle}`, `Product reference has no Shopify GID yet: ${product.handle}.`));
      }
    }

    for (const file of lesson.fields.downloadable_resources ?? []) {
      if (!file.gid && !file.file_gid) {
        messages.push(issue("WARNING", "UNRESOLVED_FILE_REFERENCE", `${lesson.type}:${lesson.handle}`, `Download reference has no Shopify File GID yet: ${file.handle}.`));
      }
    }

    if (lesson.fields.primary_cta && !lesson.fields.primary_cta.url) {
      messages.push(issue("WARNING", "UNRESOLVED_CTA_REFERENCE", `${lesson.type}:${lesson.handle}`, `Primary CTA has no public URL yet: ${lesson.fields.primary_cta.handle}.`));
    }
  }

  for (const category of categories) {
    checkLocalAsset(category.fields.image, `${category.type}:${category.handle}:image`, messages);
  }

  for (const pathway of pathways) {
    checkLocalAsset(pathway.fields.image, `${pathway.type}:${pathway.handle}:image`, messages);

    if (/prescription/i.test(pathway.handle) || /Prescription/i.test(pathway.fields.title)) {
      messages.push(issue("ERROR", "FUTURE_PRESCRIPTION_PATHWAY_INCLUDED", `${pathway.type}:${pathway.handle}`, "Future Prescription Masks & Underwater Vision pathway must not be part of phase-one pathway data."));
    }

    for (const lessonRef of pathway.fields.ordered_lessons ?? []) {
      if (!approvedHandleSet.has(lessonRef.handle)) {
        messages.push(issue("ERROR", "INVALID_PATHWAY_LESSON_HANDLE", `${pathway.type}:${pathway.handle}`, `Pathway references a handle outside the approved lesson index: ${lessonRef.handle}.`));
      } else if (!lessonHandleSet.has(lessonRef.handle)) {
        messages.push(issue("WARNING", "UNRESOLVED_PATHWAY_LESSON_HANDLE", `${pathway.type}:${pathway.handle}`, `Pathway lesson ${lessonRef.lesson_id || lessonRef.handle} is approved but not normalized yet.`));
      }
    }
  }

  messages.push(issue("INFO", "PILOT_SCOPE", "learning_lesson", `Normalized pilot lesson entries: ${lessons.length}.`));
  messages.push(issue("INFO", "CATEGORY_SCOPE", "learning_category", `Normalized category entries: ${categories.length}.`));
  messages.push(issue("INFO", "PATHWAY_SCOPE", "learning_pathway", `Normalized current pathway entries: ${pathways.length}.`));

  const counts = {
    ERROR: messages.filter((message) => message.severity === "ERROR").length,
    WARNING: messages.filter((message) => message.severity === "WARNING").length,
    INFO: messages.filter((message) => message.severity === "INFO").length
  };

  const report = {
    generated_at: new Date().toISOString(),
    counts,
    messages
  };

  writeJson("generated/validation-report.json", report);
  return report;
}

function printReport(report) {
  console.log("Learning data validation");
  console.log(`ERROR: ${report.counts.ERROR}`);
  console.log(`WARNING: ${report.counts.WARNING}`);
  console.log(`INFO: ${report.counts.INFO}`);
  for (const message of report.messages) {
    console.log(`${message.severity} ${message.code} ${message.target} - ${message.message}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runValidation();
  printReport(report);
  if (report.counts.ERROR > 0) process.exitCode = 1;
}

