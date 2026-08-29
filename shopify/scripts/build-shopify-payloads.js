import {
  buildDefinitionPayload,
  buildUpsertPayload,
  loadCategories,
  loadDefinitions,
  loadLessons,
  loadPathways,
  writeJson
} from "./lib/learning-data.js";

export function buildPayloads() {
  const definitions = loadDefinitions();
  const definitionByType = new Map(definitions.map((definition) => [definition.type, definition]));
  const categories = loadCategories();
  const pathways = loadPathways();
  const lessons = loadLessons();

  const payloads = {
    generated_at: new Date().toISOString(),
    network: "disabled",
    note: "Local payloads only. These are not sent to Shopify in Stage 5A.",
    upsertSemantics: "The payload builder uses metaobjectUpsert with the metaobject input form. Shopify updates only provided fields and preserves omitted fields. Do not switch to the values argument unless every managed field is intentionally supplied, because values is a full replacement and clears omitted keys.",
    definitions: definitions.map(buildDefinitionPayload),
    entries: {
      categories: categories.map((entry) => buildUpsertPayload(entry, definitionByType.get(entry.type))),
      pathways: pathways.map((entry) => buildUpsertPayload(entry, definitionByType.get(entry.type))),
      lessons: lessons.map((entry) => buildUpsertPayload(entry, definitionByType.get(entry.type)))
    },
    resolutionNotes: [
      "Metaobject references use local resolver tokens such as __RESOLVE_METAOBJECT__:learning_category:gear-masks-vision until real Shopify GIDs exist.",
      "Unresolved tool, product, file, and CTA placeholders are intentionally omitted from upsert fields until public URLs or Shopify GIDs exist.",
      "No mutations are executed by this script."
    ]
  };

  writeJson("generated/shopify-payloads.json", payloads);
  return payloads;
}

function printSummary(payloads) {
  console.log("Shopify payload builder");
  console.log(`Definitions: ${payloads.definitions.length}`);
  console.log(`Category upserts: ${payloads.entries.categories.length}`);
  console.log(`Pathway upserts: ${payloads.entries.pathways.length}`);
  console.log(`Lesson upserts: ${payloads.entries.lessons.length}`);
  console.log("Network requests: disabled");
  console.log("Wrote generated/shopify-payloads.json");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  printSummary(buildPayloads());
}

