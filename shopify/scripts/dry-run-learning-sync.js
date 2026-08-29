import { writeJson } from "./lib/learning-data.js";
import { buildPayloads } from "./build-shopify-payloads.js";
import { runValidation } from "./validate-learning-data.js";

export function runDryRun() {
  const validation = runValidation();
  const payloads = buildPayloads();
  const unresolved = validation.messages.filter((message) => /^UNRESOLVED_/.test(message.code));
  const blockingErrors = validation.messages.filter((message) => message.severity === "ERROR");
  const warnings = validation.messages.filter((message) => message.severity === "WARNING");

  const report = {
    generated_at: new Date().toISOString(),
    network: "disabled",
    definitions_that_would_be_created: payloads.definitions.map((payload) => payload.variables.definition.type),
    category_entries_that_would_be_upserted: payloads.entries.categories.map((payload) => payload.variables.handle.handle),
    pathway_entries_that_would_be_upserted: payloads.entries.pathways.map((payload) => payload.variables.handle.handle),
    lesson_entries_that_would_be_upserted: payloads.entries.lessons.map((payload) => payload.variables.handle.handle),
    unresolved_references: unresolved,
    blocking_validation_errors: blockingErrors,
    warnings,
    payload_file: "generated/shopify-payloads.json",
    validation_file: "generated/validation-report.json"
  };

  writeJson("generated/dry-run-report.json", report);
  return report;
}

function printReport(report) {
  console.log("Learning Hub Shopify dry run");
  console.log("Network requests: disabled");
  console.log(`Definitions that would be created: ${report.definitions_that_would_be_created.length}`);
  console.log(`Category entries that would be upserted: ${report.category_entries_that_would_be_upserted.length}`);
  console.log(`Pathway entries that would be upserted: ${report.pathway_entries_that_would_be_upserted.length}`);
  console.log(`Lesson entries that would be upserted: ${report.lesson_entries_that_would_be_upserted.length}`);
  console.log(`Unresolved references: ${report.unresolved_references.length}`);
  console.log(`Blocking validation errors: ${report.blocking_validation_errors.length}`);
  console.log(`Warnings: ${report.warnings.length}`);

  if (report.blocking_validation_errors.length) {
    console.log("");
    console.log("Blocking validation errors");
    for (const message of report.blocking_validation_errors) {
      console.log(`ERROR ${message.code} ${message.target} - ${message.message}`);
    }
  }

  if (report.unresolved_references.length) {
    console.log("");
    console.log("Unresolved references");
    for (const message of report.unresolved_references) {
      console.log(`${message.severity} ${message.code} ${message.target} - ${message.message}`);
    }
  }

  console.log("");
  console.log("Wrote generated/dry-run-report.json");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runDryRun();
  printReport(report);
  if (report.blocking_validation_errors.length) process.exitCode = 1;
}

