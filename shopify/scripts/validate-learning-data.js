import fs from "node:fs";
import path from "node:path";
import {
  LEARNING_MEDIA_ITEM_TYPES,
  LEARNING_MEDIA_LAYOUTS,
  REPO_ROOT,
  loadApprovedLessons,
  loadCategories,
  loadDefinitions,
  loadLearningMediaRegistry,
  loadLessons,
  loadPathways,
  parseContentMarker,
  parseMediaMarker,
  resolveContentMarker,
  resolveLearningMediaMarker,
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

const allowedLessonTypes = new Set([
  "Equipment guide",
  "Safety briefing",
  "Conditions explainer",
  "Skill lesson",
  "Science lesson",
  "Conservation lesson"
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

function isStandaloneMarkerLine(value, markerText) {
  return String(value ?? "")
    .split(/\r?\n/)
    .some((line) => line.trim() === markerText);
}

function isAllowedInlineBodyMarker(entry, location, value, markerText, kind, rawLabel) {
  if (entry.type !== "learning_lesson" || location !== "lesson_body") return false;
  if (!isStandaloneMarkerLine(value, markerText)) return false;

  if (["TOOL", "PRODUCT", "CTA"].includes(kind)) {
    return Boolean(resolveContentMarker(kind, rawLabel).url);
  }

  return kind === "MEDIA";
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

      // IMAGE is intentionally still detected (but never allowed) so a stray
      // pre-migration marker is flagged with a clear error instead of silently
      // passing once IMAGE stops being a recognized directive kind.
      const structuredMarkers = [...value.matchAll(/\[(TOOL|PRODUCT|DOWNLOAD|CTA|IMAGE|MEDIA):\s*([^\]]+)\]/gi)];
      for (const marker of structuredMarkers) {
        const kind = marker[1].toUpperCase();
        if (isAllowedInlineBodyMarker(entry, location, value, marker[0], kind, marker[2])) {
          continue;
        }

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

function checkLessonTypeTaxonomy(lessons, messages) {
  for (const lesson of lessons) {
    const lessonType = lesson.fields?.lesson_type;
    if (!allowedLessonTypes.has(lessonType)) {
      messages.push(issue("ERROR", "NON_CANONICAL_LESSON_TYPE", `${lesson.type}:${lesson.handle}:lesson_type`, `Non-canonical lesson_type: ${lessonType}.`));
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

function loadLocalPublicLessonHandles() {
  const lessonRoot = path.join(REPO_ROOT, "content-development", "lessons");
  if (!fs.existsSync(lessonRoot)) return new Set();

  return new Set(
    fs
      .readdirSync(lessonRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => /^(R\d{2})-(.+)$/.exec(entry.name))
      .filter(Boolean)
      .map((match) => match[2])
  );
}

function checkInlineActionMarkers(lessons, messages) {
  for (const lesson of lessons) {
    for (const rawLine of String(lesson.fields.lesson_body ?? "").split(/\r?\n/)) {
      const marker = parseContentMarker(rawLine.trim());
      if (!marker) continue;

      const resolved = resolveContentMarker(marker.kind, marker.rawLabel);
      if (!resolved.url) {
        messages.push(issue("WARNING", "UNRESOLVED_INLINE_ACTION_MARKER", `${lesson.type}:${lesson.handle}:lesson_body`, `Inline ${marker.kind} marker has no public URL yet: ${resolved.handle}.`));
      }
    }
  }
}

function checkMediaItem(media, item, target, messages) {
  if (!item.url && !item.asset_filename && !item.gid) {
    messages.push(issue("ERROR", "UNRESOLVED_INLINE_MEDIA_ASSET", target, `Inline media ${media.key} is missing an image URL or Shopify file reference.`));
  }

  if (!item.alt) {
    messages.push(issue("ERROR", "MISSING_INLINE_MEDIA_ALT", target, `Inline media ${media.key} is missing required alt text.`));
  }

  if ((!item.width || !item.height) && !item.aspect_ratio) {
    messages.push(issue("ERROR", "MISSING_INLINE_MEDIA_DIMENSIONS", target, `Inline media ${media.key} needs width and height, or aspect_ratio.`));
  }

  if (item.media_type && !LEARNING_MEDIA_ITEM_TYPES.has(item.media_type)) {
    messages.push(issue("WARNING", "UNKNOWN_INLINE_MEDIA_ITEM_TYPE", target, `Inline media ${media.key} item has an unrecognized media_type: ${item.media_type}.`));
  }
}

function checkInlineMediaMarkers(lessons, messages) {
  const registry = loadLearningMediaRegistry();

  for (const lesson of lessons) {
    for (const rawLine of String(lesson.fields.lesson_body ?? "").split(/\r?\n/)) {
      const marker = parseMediaMarker(rawLine.trim());
      if (!marker) continue;

      const media = resolveLearningMediaMarker(marker.rawKey, registry);
      const target = `${lesson.type}:${lesson.handle}:lesson_body:${media.key}`;

      if (!media.resolved) {
        messages.push(issue("ERROR", "UNRESOLVED_INLINE_MEDIA_MARKER", target, `Inline media marker has no registry record: ${media.key}.`));
        continue;
      }

      if (!LEARNING_MEDIA_LAYOUTS.has(media.layout)) {
        messages.push(issue("ERROR", "INVALID_INLINE_MEDIA_LAYOUT", target, `Inline media ${media.key} uses unsupported layout: ${media.layout}.`));
      }

      if (media.layout === "comparison" && media.items.length < 2) {
        messages.push(issue("ERROR", "INCOMPLETE_INLINE_MEDIA_COMPARISON", target, `Comparison media ${media.key} requires two image items.`));
      } else if (media.layout !== "comparison" && !media.items.length) {
        messages.push(issue("ERROR", "INCOMPLETE_INLINE_MEDIA_ITEMS", target, `Inline media ${media.key} (layout: ${media.layout}) has no media items.`));
      }

      media.items.forEach((item, index) => checkMediaItem(media, item, `${target}:items[${index}]`, messages));
    }
  }
}

// Section names that are always supposed to be their own markdown heading in
// every lesson that has them, regardless of lesson-specific content --
// established site-wide by the schema (see LESSON-SCHEMA.md) and consumed
// structurally by generate-pilot-data.js's BODY_EXCLUDED_SECTIONS /
// parseOptionalSections. If reconciliation drops the required blank-line/
// heading-marker structure around one of these, its label text survives as
// plain prose but stops acting as a section boundary -- the exact failure
// mode this check exists to catch (see STRUCTURE_COLLAPSE below).
const STANDARD_SECTION_HEADINGS = [
  "Instructor Tips",
  "Common Mistakes",
  "Safety Note",
  "Safety Notes",
  "Key Takeaways",
  "Knowledge Check",
  "Related Lessons / Next Step"
];

// Deterministic guard against Drive -> repo reconciliation silently dropping
// markdown block structure (headings/paragraphs/lists collapsing into one
// wall of text while the wording itself stays correct -- see the R08/R12
// incident this check was added for). Intentionally narrow: it only fires on
// signals that essentially never occur in genuinely well-formed content, so
// a single long-but-legitimate paragraph will not trip it.
function checkStructureCollapse(lessons, messages) {
  for (const lesson of lessons) {
    const body = String(lesson.fields.lesson_body ?? "");
    if (!body) continue;

    const blocks = body.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

    for (const block of blocks) {
      // A block that already starts with its own heading marker is fine --
      // collapse only matters for what ends up *inside* a block.
      if (/^#{2,4}\s+/.test(block)) continue;

      // A. Two or more "Qn." Knowledge Check questions inside one block means
      // the questions (and whatever separated them) lost their paragraph
      // breaks and got glued into a single wall of text.
      const questionMatches = block.match(/\bQ\d+\.\s/g) || [];
      if (questionMatches.length >= 2) {
        messages.push(issue(
          "ERROR",
          "STRUCTURE_COLLAPSE",
          `${lesson.type}:${lesson.handle}:lesson_body`,
          `${questionMatches.length} Knowledge Check questions were found inside a single paragraph block instead of separated by blank lines -- markdown structure likely collapsed during Drive reconciliation.`
        ));
      }

      // B. Two or more standard, always-a-heading section labels appear as
      // inline substrings of the same block rather than as their own
      // heading lines -- those sections' boundaries were lost.
      const embeddedHeadings = STANDARD_SECTION_HEADINGS.filter(
        (heading) => block !== heading && block.includes(heading)
      );
      if (embeddedHeadings.length >= 2) {
        messages.push(issue(
          "ERROR",
          "STRUCTURE_COLLAPSE",
          `${lesson.type}:${lesson.handle}:lesson_body`,
          `Standard section headings (${embeddedHeadings.join(", ")}) were found embedded inside a single paragraph block instead of as their own markdown headings -- markdown structure likely collapsed during Drive reconciliation.`
        ));
      }
    }

    // C. A schema list field (Key Takeaways) came back completely empty even
    // though this lesson clearly has other rich instructor-facing content --
    // near-certain sign its bullet markers were lost rather than the section
    // genuinely being blank.
    const hasOtherRichContent =
      String(lesson.fields.instructor_tips ?? "").trim().length > 80 ||
      String(lesson.fields.common_mistakes ?? "").trim().length > 80;
    if (hasOtherRichContent && Array.isArray(lesson.fields.key_takeaways) && lesson.fields.key_takeaways.length === 0) {
      messages.push(issue(
        "ERROR",
        "STRUCTURE_COLLAPSE",
        `${lesson.type}:${lesson.handle}:key_takeaways`,
        "key_takeaways is empty even though this lesson has substantial Instructor Tips/Common Mistakes content -- its bullet markers likely lost during Drive reconciliation."
      ));
    }
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
  const knownRelatedHandleSet = new Set([...approvedHandleSet, ...loadLocalPublicLessonHandles()]);
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
  checkLessonTypeTaxonomy(lessons, messages);
  checkInlineActionMarkers(lessons, messages);
  checkInlineMediaMarkers(lessons, messages);
  checkStructureCollapse(lessons, messages);

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
      if (!knownRelatedHandleSet.has(related.handle)) {
        messages.push(issue("ERROR", "INVALID_RELATED_LESSON_HANDLE", `${lesson.type}:${lesson.handle}`, `Related lesson handle is not in the approved/local lesson index: ${related.handle}.`));
      } else if (!lessonHandleSet.has(related.handle)) {
        messages.push(issue("WARNING", "UNRESOLVED_RELATED_LESSON_HANDLE", `${lesson.type}:${lesson.handle}`, `Related lesson ${related.lesson_id || related.handle} is known locally but not normalized yet.`));
      }
    }

    for (const tool of lesson.fields.related_tools ?? []) {
      if (!tool.url) {
        messages.push(issue("WARNING", "UNRESOLVED_TOOL_REFERENCE", `${lesson.type}:${lesson.handle}`, `Tool reference has no public URL yet: ${tool.handle}.`));
      }
    }

    for (const product of lesson.fields.related_products ?? []) {
      if (!product.gid && !product.url) {
        messages.push(issue("WARNING", "UNRESOLVED_PRODUCT_REFERENCE", `${lesson.type}:${lesson.handle}`, `Product reference has no Shopify GID yet: ${product.handle}.`));
      }
    }

    for (const file of lesson.fields.downloadable_resources ?? []) {
      if (!file.gid && !file.file_gid && !file.url && !file.asset_filename) {
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
