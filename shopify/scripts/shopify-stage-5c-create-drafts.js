import fs from "node:fs";
import path from "node:path";
import {
  SHOPIFY_ROOT,
  buildDefinitionAccess,
  fieldPayloadValue,
  loadCategories,
  loadDefinitions,
  loadLessons,
  writeJson
} from "./lib/learning-data.js";
import {
  createShopifyAdminClient,
  loadShopifyConfig,
  sanitizeError
} from "./shopify-admin-client.js";
import { createShopifyStage5CClient } from "./shopify-admin-write-client.js";
import { runValidation } from "./validate-learning-data.js";

const REQUIRED_STORE_NAME_MATCH = /oceans?\s+optics?/i;
const REQUIRED_MYSHOPIFY_DOMAIN = "a44b34.myshopify.com";
const REQUIRED_API_VERSION = "2026-07";
const PARTIAL_CATEGORY_DEFINITION_ID = "gid://shopify/MetaobjectDefinition/36172398925";
const LEARNING_STORE_HOST = "https://oceansoptics.com";
const PLANNED_DEFINITION_TYPES = ["learning_category", "learning_lesson", "learning_pathway"];
const ALLOWED_LESSON_IDS = new Set(["R01", "R08", "R12"]);
const REQUIRED_WRITE_SCOPES = ["write_metaobject_definitions", "write_metaobjects"];
const RELEVANT_TERMS = [
  "learning_lesson",
  "learning_category",
  "learning_pathway",
  "lesson",
  "learning",
  "guide",
  "education",
  "academy"
];

const SHOP_QUERY = `#graphql
query Stage5CShopCheck {
  shop {
    name
    myshopifyDomain
    primaryDomain {
      host
      url
    }
  }
}`;

const SCOPES_QUERY = `#graphql
query Stage5CScopes {
  currentAppInstallation {
    accessScopes {
      handle
    }
  }
}`;

const DEFINITIONS_QUERY = `#graphql
query Stage5CDefinitions($first: Int!, $after: String) {
  metaobjectDefinitions(first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        type
        name
        access {
          admin
          storefront
        }
        capabilities {
          publishable {
            enabled
          }
          renderable {
            enabled
            data {
              metaTitleKey
              metaDescriptionKey
            }
          }
          onlineStore {
            enabled
            data {
              urlHandle
            }
          }
        }
        fieldDefinitions {
          key
          name
          type {
            name
          }
          required
          validations {
            name
            value
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

const CREATE_DEFINITION_MUTATION = `#graphql
mutation Stage5CCreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
  metaobjectDefinitionCreate(definition: $definition) {
    metaobjectDefinition {
      id
      type
      name
      access {
        admin
        storefront
      }
      capabilities {
        publishable {
          enabled
        }
        renderable {
          enabled
          data {
            metaTitleKey
            metaDescriptionKey
          }
        }
        onlineStore {
          enabled
          data {
            urlHandle
          }
        }
      }
      fieldDefinitions {
        key
        name
        type {
          name
        }
        required
        validations {
          name
          value
        }
      }
    }
    userErrors {
      field
      message
      code
    }
  }
}`;

const UPDATE_DEFINITION_MUTATION = `#graphql
mutation Stage5CUpdateMetaobjectDefinition($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
  metaobjectDefinitionUpdate(id: $id, definition: $definition) {
    metaobjectDefinition {
      id
      type
      name
      access {
        admin
        storefront
      }
      capabilities {
        publishable {
          enabled
        }
        renderable {
          enabled
          data {
            metaTitleKey
            metaDescriptionKey
          }
        }
        onlineStore {
          enabled
          data {
            urlHandle
          }
        }
      }
      fieldDefinitions {
        key
        name
        type {
          name
        }
        required
        validations {
          name
          value
        }
      }
    }
    userErrors {
      field
      message
      code
    }
  }
}`;

const CREATE_METAOBJECT_MUTATION = `#graphql
mutation Stage5CCreateMetaobject($metaobject: MetaobjectCreateInput!) {
  metaobjectCreate(metaobject: $metaobject) {
    metaobject {
      id
      handle
      type
      capabilities {
        publishable {
          status
        }
      }
      category: field(key: "category") {
        value
      }
    }
    userErrors {
      field
      message
      code
    }
  }
}`;

const METAOBJECTS_QUERY = `#graphql
query Stage5CMetaobjects($type: String!, $first: Int!, $after: String) {
  metaobjects(type: $type, first: $first, after: $after) {
    nodes {
      id
      handle
      type
      capabilities {
        publishable {
          status
        }
      }
      category: field(key: "category") {
        value
      }
      fields {
        key
        value
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

const STAGE_5C_ADMIN_GRAPHQL_DOCUMENTS = [
  SHOP_QUERY,
  SCOPES_QUERY,
  DEFINITIONS_QUERY,
  CREATE_DEFINITION_MUTATION,
  UPDATE_DEFINITION_MUTATION,
  CREATE_METAOBJECT_MUTATION,
  METAOBJECTS_QUERY
];
const FORBIDDEN_METAOBJECT_URL_FIELD = ["online", "Store", "Url"].join("");

let activeRecord = null;

function issue(message) {
  return message;
}

export function assertStage5CAdminGraphqlDocuments() {
  const forbiddenFieldPattern = new RegExp(`\\b${FORBIDDEN_METAOBJECT_URL_FIELD}\\b`);
  const offenders = STAGE_5C_ADMIN_GRAPHQL_DOCUMENTS
    .map((document, index) => ({ index, document }))
    .filter(({ document }) => forbiddenFieldPattern.test(document));

  if (offenders.length) {
    throw new Error(`Stage 5C Admin GraphQL documents must not query ${FORBIDDEN_METAOBJECT_URL_FIELD}; offending document indexes: ${offenders.map((entry) => entry.index).join(", ")}.`);
  }
}

function isRelevantDefinition(definition) {
  const haystack = `${definition.type || ""} ${definition.name || ""}`.toLowerCase();
  return RELEVANT_TERMS.some((term) => haystack.includes(term.toLowerCase()));
}

function definitionByType(definitions, type) {
  return definitions.find((definition) => definition.type === type);
}

function userErrorsFrom(response, key) {
  return response?.body?.data?.[key]?.userErrors ?? [];
}

function graphqlErrors(response) {
  return response?.body?.errors?.map((error) => error.message) ?? [];
}

async function graphqlOrThrow(client, query, variables, label) {
  const graphql = client.graphql ?? client.graphqlReadOnly;
  if (!graphql) throw new Error(`${label} failed: client does not expose a GraphQL method.`);
  const response = await graphql(query, variables);
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP/API status ${response.status}: ${graphqlErrors(response).join("; ") || "unknown GraphQL error"}`);
  }
  return response;
}

async function loadAllDefinitions(client) {
  const definitions = [];
  let after = null;
  for (let page = 0; page < 10; page += 1) {
    const response = await graphqlOrThrow(client, DEFINITIONS_QUERY, { first: 100, after }, "definitions query");
    const connection = response.body.data.metaobjectDefinitions;
    definitions.push(...connection.edges.map((edge) => edge.node));
    if (!connection.pageInfo.hasNextPage) {
      return { definitions, actualApiVersion: response.actualApiVersion };
    }
    after = connection.pageInfo.endCursor;
  }
  return { definitions, warning: "Stopped definition scan after 10 pages." };
}

async function loadAllMetaobjects(client, type) {
  const entries = [];
  let after = null;
  let actualApiVersion = null;
  for (let page = 0; page < 10; page += 1) {
    const response = await graphqlOrThrow(client, METAOBJECTS_QUERY, { type, first: 100, after }, `metaobjects query ${type}`);
    actualApiVersion = response.actualApiVersion;
    const connection = response.body.data.metaobjects;
    entries.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) {
      return { entries, actualApiVersion };
    }
    after = connection.pageInfo.endCursor;
  }
  return { entries, actualApiVersion, warning: `Stopped ${type} metaobject scan after 10 pages.` };
}

function buildFieldDefinition(field, referenceDefinitionIds = {}) {
  const output = {
    key: field.key,
    name: field.name,
    type: field.type,
    required: Boolean(field.required)
  };

  if (field.type === "metaobject_reference" || field.type === "list.metaobject_reference") {
    const referenceDefinitionId = referenceDefinitionIds[field.key] || referenceDefinitionIds[field.referenceTarget];
    if (referenceDefinitionId) {
      output.validations = [
        {
          name: "metaobject_definition_id",
          value: referenceDefinitionId
        }
      ];
    } else if (field.referenceTarget) {
      output.validations = [
        {
          name: "metaobject_definition_type",
          value: field.referenceTarget
        }
      ];
    }
  }

  return output;
}

function buildDefinitionInput(definition, referenceDefinitionIds = {}) {
  const input = {
    name: definition.name,
    type: definition.type,
    displayNameKey: definition.displayNameField,
    capabilities: definition.capabilities,
    fieldDefinitions: definition.fields.map((field) => buildFieldDefinition(field, referenceDefinitionIds))
  };
  const access = buildDefinitionAccess(definition);
  if (access) input.access = access;
  return input;
}

export function buildInitialLearningLessonDefinitionInput(definition, referenceDefinitionIds = {}) {
  const input = buildDefinitionInput(definition, referenceDefinitionIds);
  input.fieldDefinitions = input.fieldDefinitions.filter((field) => field.key !== "related_lessons");
  return input;
}

export function buildRelatedLessonsFieldUpdateInput(lessonDefinitionGid, definition) {
  const relatedLessonsField = definition.fields.find((field) => field.key === "related_lessons");
  if (!relatedLessonsField) {
    throw new Error("Approved learning_lesson schema is missing related_lessons.");
  }
  if (relatedLessonsField.type !== "list.metaobject_reference" || relatedLessonsField.referenceTarget !== "learning_lesson") {
    throw new Error("related_lessons must remain list.metaobject_reference targeting learning_lesson.");
  }

  return {
    fieldDefinitions: [
      {
        create: {
          key: relatedLessonsField.key,
          name: relatedLessonsField.name,
          type: relatedLessonsField.type,
          required: Boolean(relatedLessonsField.required),
          validations: [
            {
              name: "metaobject_definition_id",
              value: lessonDefinitionGid
            }
          ]
        }
      }
    ]
  };
}

function capabilityValue(definition, capability, pathKey) {
  return definition.capabilities?.[capability]?.data?.[pathKey];
}

function compareValidationArrays(expected = [], actual = []) {
  const normalize = (items) => [...items]
    .map((item) => ({ name: item.name, value: item.value }))
    .sort((a, b) => `${a.name}:${a.value}`.localeCompare(`${b.name}:${b.value}`));
  return JSON.stringify(normalize(expected)) === JSON.stringify(normalize(actual));
}

function existingFieldTypeName(field) {
  return typeof field.type === "string" ? field.type : field.type?.name;
}

function compareDefinitionToSchema(plannedDefinition, existingDefinition, referenceDefinitionIds = {}) {
  const mismatches = [];
  const expectedInput = buildDefinitionInput(plannedDefinition, referenceDefinitionIds);
  const expectedFields = new Map(expectedInput.fieldDefinitions.map((field) => [field.key, field]));
  const actualFields = new Map((existingDefinition.fieldDefinitions ?? []).map((field) => [field.key, field]));

  if (existingDefinition.type !== expectedInput.type) {
    mismatches.push(`type expected ${expectedInput.type}, found ${existingDefinition.type}`);
  }
  if (existingDefinition.name !== expectedInput.name) {
    mismatches.push(`name expected ${expectedInput.name}, found ${existingDefinition.name}`);
  }
  if (existingDefinition.access?.storefront !== expectedInput.access?.storefront) {
    mismatches.push(`storefront access expected ${expectedInput.access?.storefront}, found ${existingDefinition.access?.storefront}`);
  }
  if (Boolean(existingDefinition.capabilities?.publishable?.enabled) !== Boolean(expectedInput.capabilities?.publishable?.enabled)) {
    mismatches.push("publishable capability differs");
  }
  if (Boolean(existingDefinition.capabilities?.renderable?.enabled) !== Boolean(expectedInput.capabilities?.renderable?.enabled)) {
    mismatches.push("renderable capability enabled state differs");
  }
  if (capabilityValue(existingDefinition, "renderable", "metaTitleKey") !== capabilityValue(expectedInput, "renderable", "metaTitleKey")) {
    mismatches.push(`renderable metaTitleKey expected ${capabilityValue(expectedInput, "renderable", "metaTitleKey")}, found ${capabilityValue(existingDefinition, "renderable", "metaTitleKey")}`);
  }
  if (capabilityValue(existingDefinition, "renderable", "metaDescriptionKey") !== capabilityValue(expectedInput, "renderable", "metaDescriptionKey")) {
    mismatches.push(`renderable metaDescriptionKey expected ${capabilityValue(expectedInput, "renderable", "metaDescriptionKey")}, found ${capabilityValue(existingDefinition, "renderable", "metaDescriptionKey")}`);
  }
  if (Boolean(existingDefinition.capabilities?.onlineStore?.enabled) !== Boolean(expectedInput.capabilities?.onlineStore?.enabled)) {
    mismatches.push("onlineStore capability enabled state differs");
  }
  if (capabilityValue(existingDefinition, "onlineStore", "urlHandle") !== capabilityValue(expectedInput, "onlineStore", "urlHandle")) {
    mismatches.push(`onlineStore urlHandle expected ${capabilityValue(expectedInput, "onlineStore", "urlHandle")}, found ${capabilityValue(existingDefinition, "onlineStore", "urlHandle")}`);
  }

  for (const [key, expectedField] of expectedFields) {
    const actualField = actualFields.get(key);
    if (!actualField) {
      mismatches.push(`missing field ${key}`);
      continue;
    }
    if (actualField.name !== expectedField.name) mismatches.push(`field ${key} name expected ${expectedField.name}, found ${actualField.name}`);
    if (existingFieldTypeName(actualField) !== expectedField.type) mismatches.push(`field ${key} type expected ${expectedField.type}, found ${existingFieldTypeName(actualField)}`);
    if (Boolean(actualField.required) !== Boolean(expectedField.required)) mismatches.push(`field ${key} required expected ${Boolean(expectedField.required)}, found ${Boolean(actualField.required)}`);
    if (!compareValidationArrays(expectedField.validations ?? [], actualField.validations ?? [])) {
      mismatches.push(`field ${key} validations differ`);
    }
  }

  for (const key of actualFields.keys()) {
    if (!expectedFields.has(key)) mismatches.push(`unexpected field ${key}`);
  }

  return mismatches;
}

function entryFieldMap(entry) {
  return new Map((entry.fields ?? []).map((field) => [field.key, field.value]));
}

function compareEntryToInput(existingEntry, expectedInput) {
  const mismatches = [];
  const actualFields = entryFieldMap(existingEntry);
  const expectedFields = new Map((expectedInput.fields ?? []).map((field) => [field.key, field.value]));

  if (existingEntry.type !== expectedInput.type) mismatches.push(`type expected ${expectedInput.type}, found ${existingEntry.type}`);
  if (existingEntry.handle !== expectedInput.handle) mismatches.push(`handle expected ${expectedInput.handle}, found ${existingEntry.handle}`);
  if (existingEntry.capabilities?.publishable?.status !== "DRAFT") {
    mismatches.push(`publishable status expected DRAFT, found ${existingEntry.capabilities?.publishable?.status || "unknown"}`);
  }

  for (const [key, expectedValue] of expectedFields) {
    const actualValue = actualFields.get(key);
    if (String(actualValue ?? "") !== String(expectedValue ?? "")) {
      mismatches.push(`field ${key} expected ${String(expectedValue ?? "")}, found ${String(actualValue ?? "")}`);
    }
  }

  return mismatches;
}

function indexByHandle(entries) {
  return new Map(entries.map((entry) => [entry.handle, entry]));
}

function unexpectedHandles(existingEntries, approvedHandles) {
  return existingEntries.map((entry) => entry.handle).filter((handle) => !approvedHandles.has(handle));
}

function expectedLessonUrlPattern(handle) {
  return `${LEARNING_STORE_HOST}/pages/learn/${handle}`;
}

function recordDefinition(record, listName, definition, note) {
  record[listName].push({
    id: definition.id,
    type: definition.type,
    name: definition.name,
    note
  });
}

function categorySummary(entry) {
  return {
    id: entry.id,
    handle: entry.handle,
    status: entry.capabilities?.publishable?.status
  };
}

function lessonSummary(entry, lessonId) {
  return {
    id: entry.id,
    lesson_id: lessonId,
    handle: entry.handle,
    status: entry.capabilities?.publishable?.status,
    primary_category_reference: entry.category?.value,
    expected_url_pattern: expectedLessonUrlPattern(entry.handle)
  };
}

function valueField(key, value) {
  if (value === null || value === undefined || value === "") return null;
  return { key, value: String(value) };
}

function approvedHumanValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/\b(codex|development|generated|automation)\b/i.test(text)) return null;
  return text;
}

function richField(key, markdown, fieldDefinition) {
  const value = fieldPayloadValue(fieldDefinition.type, markdown, fieldDefinition);
  if (!value) return null;
  return { key, value };
}

function listField(key, value, fieldDefinition) {
  const payload = fieldPayloadValue(fieldDefinition.type, value, fieldDefinition);
  if (!payload) return null;
  return { key, value: payload };
}

function buildCategoryCreateInput(category) {
  const fields = [
    valueField("title", category.fields.title),
    valueField("short_description", category.fields.short_description),
    valueField("sort_order", category.fields.sort_order)
  ].filter(Boolean);

  return {
    type: "learning_category",
    handle: category.handle,
    capabilities: {
      publishable: {
        status: "DRAFT"
      }
    },
    fields
  };
}

function buildLessonCreateInput(lesson, fieldDefinitions, categoryGids, createdLessonGids) {
  const definitionByKey = new Map(fieldDefinitions.map((field) => [field.key, field]));
  const omitted = [];
  const fields = [];
  const add = (field) => {
    if (field) fields.push(field);
  };

  add(valueField("title", lesson.fields.title));
  add(valueField("short_description", lesson.fields.short_description));
  add(valueField("lesson_type", lesson.fields.lesson_type));
  add(valueField("category", categoryGids[lesson.fields.category]));
  add(valueField("estimated_reading_time", lesson.fields.estimated_reading_time));
  add(richField("lesson_body", lesson.fields.lesson_body, definitionByKey.get("lesson_body")));
  add(richField("instructor_tips", lesson.fields.instructor_tips, definitionByKey.get("instructor_tips")));
  add(richField("common_mistakes", lesson.fields.common_mistakes, definitionByKey.get("common_mistakes")));
  add(richField("safety_notes", lesson.fields.safety_notes, definitionByKey.get("safety_notes")));
  add(listField("key_takeaways", lesson.fields.key_takeaways, definitionByKey.get("key_takeaways")));

  const existingRelatedLessons = (lesson.fields.related_lessons ?? [])
    .filter((entry) => createdLessonGids[entry.handle])
    .map((entry) => ({ handle: entry.handle, gid: createdLessonGids[entry.handle] }));
  if (existingRelatedLessons.length) {
    add(listField("related_lessons", existingRelatedLessons, definitionByKey.get("related_lessons")));
  } else if ((lesson.fields.related_lessons ?? []).length) {
    omitted.push({
      field: "related_lessons",
      reason: "Related lesson entries do not yet exist in Shopify.",
      handles: lesson.fields.related_lessons.map((entry) => entry.handle)
    });
  }

  if ((lesson.fields.related_tools ?? []).some((entry) => !entry.url)) {
    omitted.push({
      field: "related_tools",
      reason: "Tool URLs are unresolved.",
      handles: lesson.fields.related_tools.map((entry) => entry.handle)
    });
  }

  if ((lesson.fields.related_products ?? []).some((entry) => !entry.gid)) {
    omitted.push({
      field: "related_products",
      reason: "Product GIDs are unresolved and prescription-mask-collection must not be resolved during Stage 5C.",
      handles: lesson.fields.related_products.map((entry) => entry.handle)
    });
  }

  if ((lesson.fields.downloadable_resources ?? []).some((entry) => !entry.gid && !entry.file_gid)) {
    omitted.push({
      field: "downloadable_resources",
      reason: "Shopify File GIDs are unresolved.",
      handles: lesson.fields.downloadable_resources.map((entry) => entry.handle)
    });
  }

  if (lesson.fields.primary_cta && !lesson.fields.primary_cta.url) {
    omitted.push({
      field: "primary_cta",
      reason: "CTA URL is unresolved.",
      handles: [lesson.fields.primary_cta.handle]
    });
  }

  add(valueField("lesson_id", lesson.fields.lesson_id));
  add(valueField("author", approvedHumanValue(lesson.fields.author)));
  add(valueField("reviewer", approvedHumanValue(lesson.fields.reviewer)));
  add(valueField("last_reviewed", approvedHumanValue(lesson.fields.last_reviewed)));
  add(valueField("seo_title", lesson.fields.seo_title));
  add(valueField("meta_description", lesson.fields.meta_description));

  return {
    input: {
      type: "learning_lesson",
      handle: lesson.handle,
      capabilities: {
        publishable: {
          status: "DRAFT"
        }
      },
      fields
    },
    omitted
  };
}

function reportSkeleton() {
  return {
    generated_at: new Date().toISOString(),
    api_version: REQUIRED_API_VERSION,
    store_confirmation: {
      confirmed: false,
      shop_name: null,
      myshopify_domain: null,
      requested_api_version: REQUIRED_API_VERSION,
      returned_api_versions: []
    },
    write_scopes_confirmed: false,
    definitions_reused: [],
    definitions_created: [],
    categories_reused: [],
    categories_created: [],
    pilot_lessons_reused: [],
    pilot_lessons_created: [],
    definition_updates: [],
    pathway_definition_created: null,
    pathway_definition_reused: null,
    pathway_entries: {
      expected: 0,
      actual: null
    },
    omitted_deferred_references: [],
    shopify_user_errors: [],
    draft_status_verification: {
      all_created_entries_draft: false,
      categories: [],
      lessons: []
    },
    unexpected_changes: [],
    blocking_issues: [],
    operation_log: [],
    post_write_verification: {
      performed: false,
      definitions_present: [],
      definitions_missing: [],
      entry_counts: {}
    },
    safe_to_proceed_to_theme_pilot: false
  };
}

function writeMarkdownResult(record) {
  const lines = [];
  lines.push("# Stage 5C Result");
  lines.push("");
  lines.push(`Generated at: ${record.generated_at}`);
  lines.push("");
  lines.push("## Store Confirmation");
  lines.push("");
  lines.push(`- Confirmed: ${record.store_confirmation.confirmed ? "YES" : "NO"}`);
  lines.push(`- Shop name: ${record.store_confirmation.shop_name || "not confirmed"}`);
  lines.push(`- MyShopify domain: ${record.store_confirmation.myshopify_domain || "not confirmed"}`);
  lines.push(`- Requested API version: ${record.store_confirmation.requested_api_version}`);
  lines.push(`- Returned API versions: ${record.store_confirmation.returned_api_versions.length ? record.store_confirmation.returned_api_versions.join(", ") : "not confirmed"}`);
  lines.push("");
  lines.push("## Write Scopes Confirmed");
  lines.push("");
  lines.push(record.write_scopes_confirmed ? "YES" : "NO");
  lines.push("");
  lines.push("## Definitions Reused");
  lines.push("");
  lines.push(record.definitions_reused.length ? record.definitions_reused.map((entry) => `- ${entry.type}: ${entry.id} (${entry.note})`).join("\n") : "_None._");
  lines.push("");
  lines.push("## Definitions Created This Run");
  lines.push("");
  lines.push(record.definitions_created.length ? record.definitions_created.map((entry) => `- ${entry.type}: ${entry.id} (${entry.note})`).join("\n") : "_None._");
  lines.push("");
  lines.push("## Categories Reused");
  lines.push("");
  lines.push(record.categories_reused.length ? record.categories_reused.map((entry) => `- ${entry.handle}: ${entry.id} (${entry.status})`).join("\n") : "_None._");
  lines.push("");
  lines.push("## Categories Created This Run");
  lines.push("");
  lines.push(record.categories_created.length ? record.categories_created.map((entry) => `- ${entry.handle}: ${entry.id} (${entry.status})`).join("\n") : "_None._");
  lines.push("");
  lines.push("## Pilot Lessons Reused");
  lines.push("");
  lines.push(record.pilot_lessons_reused.length
    ? record.pilot_lessons_reused.map((entry) => `- ${entry.lesson_id} ${entry.handle}: ${entry.id} (${entry.status}); category ${entry.primary_category_reference || "not verified"}; Expected URL pattern ${entry.expected_url_pattern}`).join("\n")
    : "_None._");
  lines.push("");
  lines.push("## Pilot Lessons Created This Run");
  lines.push("");
  lines.push(record.pilot_lessons_created.length
    ? record.pilot_lessons_created.map((entry) => `- ${entry.lesson_id} ${entry.handle}: ${entry.id} (${entry.status}); category ${entry.primary_category_reference || "not verified"}; Expected URL pattern ${entry.expected_url_pattern}`).join("\n")
    : "_None._");
  lines.push("");
  lines.push("## Definition Updates This Run");
  lines.push("");
  lines.push(record.definition_updates.length ? record.definition_updates.map((entry) => `- ${entry.type}: ${entry.field_key} (${entry.note})`).join("\n") : "_None._");
  lines.push("");
  lines.push("## Pathway Definition Created");
  lines.push("");
  lines.push(record.pathway_definition_created ? `- ${record.pathway_definition_created.type}: ${record.pathway_definition_created.id}` : "_None._");
  lines.push("");
  lines.push("## Pathway Definition Reused");
  lines.push("");
  lines.push(record.pathway_definition_reused ? `- ${record.pathway_definition_reused.type}: ${record.pathway_definition_reused.id} (${record.pathway_definition_reused.note})` : "_None._");
  lines.push("");
  lines.push("## Pathway Entries");
  lines.push("");
  lines.push(`Expected: ${record.pathway_entries.expected}`);
  lines.push(`Actual: ${record.pathway_entries.actual ?? "not verified"}`);
  lines.push("");
  lines.push("## Omitted/Deferred References");
  lines.push("");
  lines.push(record.omitted_deferred_references.length ? record.omitted_deferred_references.map((entry) => `- ${entry.lesson_handle || entry.handle}: ${entry.field} - ${entry.reason}`).join("\n") : "_None._");
  lines.push("");
  lines.push("## Shopify User Errors");
  lines.push("");
  lines.push(record.shopify_user_errors.length ? "```json\n" + JSON.stringify(record.shopify_user_errors, null, 2) + "\n```" : "_None._");
  lines.push("");
  lines.push("## Draft Status Verification");
  lines.push("");
  lines.push(`- All created entries DRAFT: ${record.draft_status_verification.all_created_entries_draft ? "YES" : "NO"}`);
  if (record.draft_status_verification.categories.length) {
    lines.push("- Categories:");
    lines.push(record.draft_status_verification.categories.map((entry) => `  - ${entry.handle}: ${entry.id} (${entry.status})`).join("\n"));
  }
  if (record.draft_status_verification.lessons.length) {
    lines.push("- Pilot lessons:");
    lines.push(record.draft_status_verification.lessons.map((entry) => `  - ${entry.handle}: ${entry.id} (${entry.status}); category ${entry.primary_category_reference || "not verified"}; Expected URL pattern ${entry.expected_url_pattern}`).join("\n"));
  }
  lines.push("");
  lines.push("## Unexpected Changes");
  lines.push("");
  lines.push(record.unexpected_changes.length ? record.unexpected_changes.map((entry) => `- ${entry}`).join("\n") : "_None._");
  lines.push("");
  lines.push("## Blocking Issues");
  lines.push("");
  lines.push(record.blocking_issues.length ? record.blocking_issues.map((entry) => `- ${entry}`).join("\n") : "_None._");
  lines.push("");
  lines.push("## Post-Write Verification");
  lines.push("");
  lines.push(`- Verification performed: ${record.post_write_verification.performed ? "YES" : "NO"}`);
  lines.push(`- Definitions present: ${record.post_write_verification.definitions_present.length ? record.post_write_verification.definitions_present.join(", ") : "not verified"}`);
  lines.push(`- Definitions missing: ${record.post_write_verification.definitions_missing.length ? record.post_write_verification.definitions_missing.join(", ") : "none"}`);
  for (const [type, count] of Object.entries(record.post_write_verification.entry_counts || {})) {
    lines.push(`- ${type} entries: ${count}`);
  }
  lines.push("");
  lines.push("## Safe to Proceed to Theme Pilot?");
  lines.push("");
  lines.push(record.safe_to_proceed_to_theme_pilot ? "YES" : "NO");
  lines.push("");
  fs.writeFileSync(path.join(SHOPIFY_ROOT, "STAGE-5C-RESULT.md"), `${lines.join("\n")}\n`);
}

function writeOutputs(record) {
  writeJson("generated/stage-5c-created-resources.json", record);
  writeMarkdownResult(record);
}

async function stop(record, message) {
  record.blocking_issues.push(message);
  record.store_confirmation.returned_api_versions = [...new Set(record.store_confirmation.returned_api_versions.filter(Boolean))];
  writeOutputs(record);
  console.log(`STOP: ${message}`);
  console.log("Wrote STAGE-5C-RESULT.md and generated/stage-5c-created-resources.json");
  process.exitCode = 1;
}

async function main() {
  assertStage5CAdminGraphqlDocuments();
  const record = reportSkeleton();
  activeRecord = record;
  const config = loadShopifyConfig();

  if (!config.configured) {
    await stop(record, `Authentication is not configured. Missing: ${config.missing.join(", ")}.`);
    return;
  }

  if (config.apiVersion !== REQUIRED_API_VERSION) {
    await stop(record, `SHOPIFY_API_VERSION must be ${REQUIRED_API_VERSION}; found ${config.apiVersion}.`);
    return;
  }

  const readClient = createShopifyAdminClient(config);
  const writeClient = createShopifyStage5CClient(config);

  console.log("Stage 5C controlled Shopify draft creation");
  console.log(`Requested API version: ${REQUIRED_API_VERSION}`);
  console.log("Planned writes:");
  console.log("- Create definitions: learning_category, learning_lesson, learning_pathway");
  console.log("- Create DRAFT category entries: 5");
  console.log("- Create DRAFT pilot lesson entries: R01, R08, R12");
  console.log("- Create pathway entries: 0");

  const shopResponse = await graphqlOrThrow(readClient, SHOP_QUERY, {}, "shop confirmation");
  const shop = shopResponse.body.data.shop;
  record.store_confirmation.returned_api_versions.push(shopResponse.actualApiVersion);
  record.store_confirmation.shop_name = shop.name;
  record.store_confirmation.myshopify_domain = shop.myshopifyDomain;
  record.store_confirmation.confirmed = REQUIRED_STORE_NAME_MATCH.test(shop.name || "") && shop.myshopifyDomain === REQUIRED_MYSHOPIFY_DOMAIN;

  console.log(`Connected shop: ${shop.name} (${shop.myshopifyDomain})`);

  if (!record.store_confirmation.confirmed) {
    await stop(record, `Connected shop is not the approved Oceans Optics store ${REQUIRED_MYSHOPIFY_DOMAIN}.`);
    return;
  }

  if (shopResponse.actualApiVersion !== REQUIRED_API_VERSION) {
    await stop(record, `Shopify returned API version ${shopResponse.actualApiVersion}; expected ${REQUIRED_API_VERSION}.`);
    return;
  }

  const scopesResponse = await graphqlOrThrow(readClient, SCOPES_QUERY, {}, "scope confirmation");
  record.store_confirmation.returned_api_versions.push(scopesResponse.actualApiVersion);
  const scopes = scopesResponse.body.data.currentAppInstallation.accessScopes.map((scope) => scope.handle);
  const missingWriteScopes = REQUIRED_WRITE_SCOPES.filter((scope) => !scopes.includes(scope));
  record.write_scopes_confirmed = missingWriteScopes.length === 0;
  if (missingWriteScopes.length) {
    await stop(record, `Missing required Stage 5C write scopes: ${missingWriteScopes.join(", ")}.`);
    return;
  }

  const validation = runValidation();
  if (validation.counts.ERROR > 0) {
    await stop(record, `Local validation has ${validation.counts.ERROR} blocking errors.`);
    return;
  }

  const definitions = loadDefinitions();
  const categoryDefinition = definitionByType(definitions, "learning_category");
  const lessonDefinition = definitionByType(definitions, "learning_lesson");
  const pathwayDefinition = definitionByType(definitions, "learning_pathway");
  const categoryData = loadCategories();
  const approvedCategoryHandles = new Set(categoryData.map((category) => category.handle));
  const lessonData = loadLessons()
    .filter((lesson) => ALLOWED_LESSON_IDS.has(lesson.fields.lesson_id))
    .sort((a, b) => a.fields.lesson_id.localeCompare(b.fields.lesson_id));
  const approvedLessonHandles = new Set(lessonData.map((lesson) => lesson.handle));

  if (lessonData.length !== 3) {
    await stop(record, `Expected exactly 3 pilot lessons R01/R08/R12; found ${lessonData.length}.`);
    return;
  }

  const definitionScan = await loadAllDefinitions(readClient);
  if (definitionScan.actualApiVersion) record.store_confirmation.returned_api_versions.push(definitionScan.actualApiVersion);
  const relevantDefinitions = definitionScan.definitions.filter(isRelevantDefinition);
  const unexpectedDefinitions = relevantDefinitions.filter((definition) => !PLANNED_DEFINITION_TYPES.includes(definition.type));
  if (unexpectedDefinitions.length) {
    await stop(record, `Unexpected matching metaobject definitions already exist: ${unexpectedDefinitions.map((definition) => `${definition.type} (${definition.name})`).join(", ")}.`);
    return;
  }
  const existingDefinitionsByType = new Map(definitionScan.definitions.map((definition) => [definition.type, definition]));

  let createdCategoryDefinition = existingDefinitionsByType.get("learning_category");
  if (createdCategoryDefinition) {
    const categoryMismatches = compareDefinitionToSchema(categoryDefinition, createdCategoryDefinition);
    if (categoryMismatches.length) {
      await stop(record, `Existing learning_category definition differs from approved schema: ${categoryMismatches.join("; ")}.`);
      return;
    }
    const note = createdCategoryDefinition.id === PARTIAL_CATEGORY_DEFINITION_ID ? "REUSED FROM PARTIAL RUN" : "REUSED FROM PRIOR MATCHING RUN";
    recordDefinition(record, "definitions_reused", createdCategoryDefinition, note);
    record.operation_log.push(`Reused learning_category definition (${note}).`);
    console.log(`Reusing learning_category definition: ${createdCategoryDefinition.id}`);
  } else {
    console.log("Creating learning_category definition...");
    const categoryDefinitionResponse = await graphqlOrThrow(writeClient, CREATE_DEFINITION_MUTATION, {
      definition: buildDefinitionInput(categoryDefinition)
    }, "create learning_category definition");
    record.store_confirmation.returned_api_versions.push(categoryDefinitionResponse.actualApiVersion);
    const categoryDefinitionErrors = userErrorsFrom(categoryDefinitionResponse, "metaobjectDefinitionCreate");
    if (categoryDefinitionErrors.length) {
      record.shopify_user_errors.push({ operation: "create learning_category definition", userErrors: categoryDefinitionErrors });
      await stop(record, "Shopify rejected learning_category definition creation.");
      return;
    }
    createdCategoryDefinition = categoryDefinitionResponse.body.data.metaobjectDefinitionCreate.metaobjectDefinition;
    recordDefinition(record, "definitions_created", createdCategoryDefinition, "CREATED THIS RUN");
    record.operation_log.push("Created learning_category definition.");
  }

  console.log("Creating or reusing 5 DRAFT category entries...");
  const existingCategoryScan = await loadAllMetaobjects(readClient, "learning_category");
  if (existingCategoryScan.actualApiVersion) record.store_confirmation.returned_api_versions.push(existingCategoryScan.actualApiVersion);
  const unexpectedCategoryHandles = unexpectedHandles(existingCategoryScan.entries, approvedCategoryHandles);
  if (unexpectedCategoryHandles.length) {
    await stop(record, `Unexpected learning_category entries already exist: ${unexpectedCategoryHandles.join(", ")}.`);
    return;
  }
  const existingCategoriesByHandle = indexByHandle(existingCategoryScan.entries);
  const categoryGids = {};
  for (const category of categoryData) {
    const expectedInput = buildCategoryCreateInput(category);
    const existing = existingCategoriesByHandle.get(category.handle);
    if (existing) {
      const mismatches = compareEntryToInput(existing, expectedInput);
      if (mismatches.length) {
        await stop(record, `Existing category entry ${category.handle} differs from approved draft payload: ${mismatches.join("; ")}.`);
        return;
      }
      categoryGids[existing.handle] = existing.id;
      record.categories_reused.push(categorySummary(existing));
      record.operation_log.push(`Reused category ${category.handle}.`);
      continue;
    }

    const response = await graphqlOrThrow(writeClient, CREATE_METAOBJECT_MUTATION, { metaobject: expectedInput }, `create category ${category.handle}`);
    record.store_confirmation.returned_api_versions.push(response.actualApiVersion);
    const errors = userErrorsFrom(response, "metaobjectCreate");
    if (errors.length) {
      record.shopify_user_errors.push({ operation: `create category ${category.handle}`, userErrors: errors });
      await stop(record, `Shopify rejected category entry ${category.handle}.`);
      return;
    }
    const created = response.body.data.metaobjectCreate.metaobject;
    categoryGids[created.handle] = created.id;
    record.categories_created.push(categorySummary(created));
  }
  record.operation_log.push(`Category draft entries ready: ${record.categories_created.length} created, ${record.categories_reused.length} reused.`);

  let createdLessonDefinition = existingDefinitionsByType.get("learning_lesson");
  if (createdLessonDefinition) {
    const lessonDefinitionMismatches = compareDefinitionToSchema(lessonDefinition, createdLessonDefinition, {
      category: createdCategoryDefinition.id,
      related_lessons: createdLessonDefinition.id
    });
    if (lessonDefinitionMismatches.length) {
      await stop(record, `Existing learning_lesson definition differs from approved schema: ${lessonDefinitionMismatches.join("; ")}.`);
      return;
    }
    recordDefinition(record, "definitions_reused", createdLessonDefinition, "REUSED FROM PRIOR MATCHING RUN");
    record.operation_log.push("Reused learning_lesson definition.");
  } else {
    console.log("Creating learning_lesson definition without related_lessons...");
    const lessonDefinitionResponse = await graphqlOrThrow(writeClient, CREATE_DEFINITION_MUTATION, {
      definition: buildInitialLearningLessonDefinitionInput(lessonDefinition, {
        category: createdCategoryDefinition.id
      })
    }, "create learning_lesson definition");
    record.store_confirmation.returned_api_versions.push(lessonDefinitionResponse.actualApiVersion);
    const lessonDefinitionErrors = userErrorsFrom(lessonDefinitionResponse, "metaobjectDefinitionCreate");
    if (lessonDefinitionErrors.length) {
      record.shopify_user_errors.push({ operation: "create learning_lesson definition", userErrors: lessonDefinitionErrors });
      await stop(record, "Shopify rejected learning_lesson definition creation.");
      return;
    }
    createdLessonDefinition = lessonDefinitionResponse.body.data.metaobjectDefinitionCreate.metaobjectDefinition;
    recordDefinition(record, "definitions_created", createdLessonDefinition, "CREATED THIS RUN");
    record.operation_log.push("Created initial learning_lesson definition without related_lessons.");

    console.log("Adding related_lessons self-reference field to learning_lesson definition...");
    const relatedLessonsUpdateResponse = await graphqlOrThrow(writeClient, UPDATE_DEFINITION_MUTATION, {
      id: createdLessonDefinition.id,
      definition: buildRelatedLessonsFieldUpdateInput(createdLessonDefinition.id, lessonDefinition)
    }, "add related_lessons field to learning_lesson definition");
    record.store_confirmation.returned_api_versions.push(relatedLessonsUpdateResponse.actualApiVersion);
    const relatedLessonsUpdateErrors = userErrorsFrom(relatedLessonsUpdateResponse, "metaobjectDefinitionUpdate");
    if (relatedLessonsUpdateErrors.length) {
      record.shopify_user_errors.push({ operation: "add related_lessons to learning_lesson definition", userErrors: relatedLessonsUpdateErrors });
      await stop(record, "Shopify rejected related_lessons field update on learning_lesson definition.");
      return;
    }
    createdLessonDefinition = relatedLessonsUpdateResponse.body.data.metaobjectDefinitionUpdate.metaobjectDefinition;
    record.definition_updates.push({
      id: createdLessonDefinition.id,
      type: createdLessonDefinition.type,
      field_key: "related_lessons",
      note: "ADDED SELF-REFERENCE FIELD THIS RUN"
    });
    record.operation_log.push("Added related_lessons self-reference field to learning_lesson definition.");

    const finalLessonDefinitionMismatches = compareDefinitionToSchema(lessonDefinition, createdLessonDefinition, {
      category: createdCategoryDefinition.id,
      related_lessons: createdLessonDefinition.id
    });
    if (finalLessonDefinitionMismatches.length) {
      await stop(record, `Created learning_lesson definition does not match final approved schema after related_lessons update: ${finalLessonDefinitionMismatches.join("; ")}.`);
      return;
    }
  }

  console.log("Creating or reusing 3 DRAFT pilot lesson entries...");
  const existingLessonScan = await loadAllMetaobjects(readClient, "learning_lesson");
  if (existingLessonScan.actualApiVersion) record.store_confirmation.returned_api_versions.push(existingLessonScan.actualApiVersion);
  const unexpectedLessonHandles = unexpectedHandles(existingLessonScan.entries, approvedLessonHandles);
  if (unexpectedLessonHandles.length) {
    await stop(record, `Unexpected learning_lesson entries already exist: ${unexpectedLessonHandles.join(", ")}.`);
    return;
  }
  const existingLessonsByHandle = indexByHandle(existingLessonScan.entries);
  const createdLessonGids = {};
  for (const lesson of lessonData) {
    const { input, omitted } = buildLessonCreateInput(lesson, lessonDefinition.fields, categoryGids, createdLessonGids);
    record.omitted_deferred_references.push(...omitted.map((entry) => ({ lesson_handle: lesson.handle, ...entry })));
    const existing = existingLessonsByHandle.get(lesson.handle);
    if (existing) {
      const mismatches = compareEntryToInput(existing, input);
      if (mismatches.length) {
        await stop(record, `Existing lesson entry ${lesson.handle} differs from approved draft payload: ${mismatches.join("; ")}.`);
        return;
      }
      createdLessonGids[existing.handle] = existing.id;
      record.pilot_lessons_reused.push(lessonSummary(existing, lesson.fields.lesson_id));
      record.operation_log.push(`Reused pilot lesson ${lesson.handle}.`);
      continue;
    }

    const response = await graphqlOrThrow(writeClient, CREATE_METAOBJECT_MUTATION, {
      metaobject: input
    }, `create lesson ${lesson.handle}`);
    record.store_confirmation.returned_api_versions.push(response.actualApiVersion);
    const errors = userErrorsFrom(response, "metaobjectCreate");
    if (errors.length) {
      record.shopify_user_errors.push({ operation: `create lesson ${lesson.handle}`, userErrors: errors });
      await stop(record, `Shopify rejected lesson entry ${lesson.handle}.`);
      return;
    }
    const created = response.body.data.metaobjectCreate.metaobject;
    createdLessonGids[created.handle] = created.id;
    record.pilot_lessons_created.push(lessonSummary(created, lesson.fields.lesson_id));
  }
  record.operation_log.push(`Pilot lesson draft entries ready: ${record.pilot_lessons_created.length} created, ${record.pilot_lessons_reused.length} reused.`);

  let createdPathwayDefinition = existingDefinitionsByType.get("learning_pathway");
  if (createdPathwayDefinition) {
    const pathwayDefinitionMismatches = compareDefinitionToSchema(pathwayDefinition, createdPathwayDefinition, {
      ordered_lessons: createdLessonDefinition.id
    });
    if (pathwayDefinitionMismatches.length) {
      await stop(record, `Existing learning_pathway definition differs from approved schema: ${pathwayDefinitionMismatches.join("; ")}.`);
      return;
    }
    record.pathway_definition_reused = {
      id: createdPathwayDefinition.id,
      type: createdPathwayDefinition.type,
      name: createdPathwayDefinition.name,
      note: "REUSED FROM PRIOR MATCHING RUN"
    };
    recordDefinition(record, "definitions_reused", createdPathwayDefinition, "REUSED FROM PRIOR MATCHING RUN");
    record.operation_log.push("Reused learning_pathway definition.");
  } else {
    console.log("Creating learning_pathway definition only; no pathway entries...");
    const pathwayDefinitionResponse = await graphqlOrThrow(writeClient, CREATE_DEFINITION_MUTATION, {
      definition: buildDefinitionInput(pathwayDefinition, {
        ordered_lessons: createdLessonDefinition.id
      })
    }, "create learning_pathway definition");
    record.store_confirmation.returned_api_versions.push(pathwayDefinitionResponse.actualApiVersion);
    const pathwayDefinitionErrors = userErrorsFrom(pathwayDefinitionResponse, "metaobjectDefinitionCreate");
    if (pathwayDefinitionErrors.length) {
      record.shopify_user_errors.push({ operation: "create learning_pathway definition", userErrors: pathwayDefinitionErrors });
      await stop(record, "Shopify rejected learning_pathway definition creation.");
      return;
    }
    createdPathwayDefinition = pathwayDefinitionResponse.body.data.metaobjectDefinitionCreate.metaobjectDefinition;
    recordDefinition(record, "definitions_created", createdPathwayDefinition, "CREATED THIS RUN");
    record.pathway_definition_created = {
      id: createdPathwayDefinition.id,
      type: createdPathwayDefinition.type,
      name: createdPathwayDefinition.name,
      note: "CREATED THIS RUN"
    };
    record.operation_log.push("Created learning_pathway definition.");
  }

  console.log("Running post-write verification...");
  const postDefinitions = await loadAllDefinitions(readClient);
  if (postDefinitions.actualApiVersion) record.store_confirmation.returned_api_versions.push(postDefinitions.actualApiVersion);
  const missingDefinitions = PLANNED_DEFINITION_TYPES.filter((type) => !postDefinitions.definitions.some((definition) => definition.type === type));
  if (missingDefinitions.length) {
    record.unexpected_changes.push(`Definitions missing after write: ${missingDefinitions.join(", ")}.`);
  }

  const verifiedCategoryScan = await loadAllMetaobjects(readClient, "learning_category");
  const verifiedLessonScan = await loadAllMetaobjects(readClient, "learning_lesson");
  const verifiedPathwayScan = await loadAllMetaobjects(readClient, "learning_pathway");
  record.store_confirmation.returned_api_versions.push(verifiedCategoryScan.actualApiVersion, verifiedLessonScan.actualApiVersion, verifiedPathwayScan.actualApiVersion);

  const verifiedCategories = verifiedCategoryScan.entries;
  const verifiedLessons = verifiedLessonScan.entries;
  const verifiedPathways = verifiedPathwayScan.entries;
  record.pathway_entries.actual = verifiedPathways.length;
  record.draft_status_verification.categories = verifiedCategories.map(categorySummary);
  record.draft_status_verification.lessons = verifiedLessons.map((entry) => ({
    id: entry.id,
    lesson_id: entryFieldMap(entry).get("lesson_id"),
    handle: entry.handle,
    status: entry.capabilities.publishable.status,
    primary_category_reference: entry.category?.value,
    expected_url_pattern: expectedLessonUrlPattern(entry.handle)
  }));

  if (verifiedCategories.length !== 5) record.unexpected_changes.push(`Expected exactly 5 category entries; found ${verifiedCategories.length}.`);
  if (verifiedLessons.length !== 3) record.unexpected_changes.push(`Expected exactly 3 lesson entries; found ${verifiedLessons.length}.`);
  if (verifiedPathways.length !== 0) record.unexpected_changes.push(`Expected exactly 0 pathway entries; found ${verifiedPathways.length}.`);
  const missingCategoryHandles = [...approvedCategoryHandles].filter((handle) => !verifiedCategories.some((entry) => entry.handle === handle));
  const extraCategoryHandles = unexpectedHandles(verifiedCategories, approvedCategoryHandles);
  const missingLessonHandles = [...approvedLessonHandles].filter((handle) => !verifiedLessons.some((entry) => entry.handle === handle));
  const extraLessonHandles = unexpectedHandles(verifiedLessons, approvedLessonHandles);
  if (missingCategoryHandles.length) record.unexpected_changes.push(`Missing approved category entries: ${missingCategoryHandles.join(", ")}.`);
  if (extraCategoryHandles.length) record.unexpected_changes.push(`Unexpected category entries: ${extraCategoryHandles.join(", ")}.`);
  if (missingLessonHandles.length) record.unexpected_changes.push(`Missing approved pilot lesson entries: ${missingLessonHandles.join(", ")}.`);
  if (extraLessonHandles.length) record.unexpected_changes.push(`Unexpected pilot lesson entries: ${extraLessonHandles.join(", ")}.`);

  const allDraft = [...verifiedCategories, ...verifiedLessons].every((entry) => entry.capabilities.publishable.status === "DRAFT");
  record.draft_status_verification.all_created_entries_draft = allDraft;
  if (!allDraft) record.unexpected_changes.push("One or more created category/lesson entries is not DRAFT.");

  const presentDefinitions = PLANNED_DEFINITION_TYPES.filter((type) => postDefinitions.definitions.some((definition) => definition.type === type));
  record.post_write_verification = {
    performed: true,
    definitions_present: presentDefinitions,
    definitions_missing: missingDefinitions,
    entry_counts: {
      learning_category: verifiedCategories.length,
      learning_lesson: verifiedLessons.length,
      learning_pathway: verifiedPathways.length
    }
  };

  record.store_confirmation.returned_api_versions = [...new Set(record.store_confirmation.returned_api_versions.filter(Boolean))];
  record.safe_to_proceed_to_theme_pilot = record.unexpected_changes.length === 0 && record.shopify_user_errors.length === 0 && record.blocking_issues.length === 0;
  writeOutputs(record);

  console.log("Stage 5C complete.");
  console.log(`Definitions created: ${record.definitions_created.length}`);
  console.log(`Categories created: ${record.categories_created.length}`);
  console.log(`Pilot lessons created: ${record.pilot_lessons_created.length}`);
  console.log(`Pathway entries created: ${record.pathway_entries.actual}`);
  console.log(`Safe to proceed to theme pilot: ${record.safe_to_proceed_to_theme_pilot ? "YES" : "NO"}`);
  console.log("Wrote STAGE-5C-RESULT.md and generated/stage-5c-created-resources.json");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const record = activeRecord || reportSkeleton();
    record.blocking_issues.push(sanitizeError(error).message);
    record.store_confirmation.returned_api_versions = [...new Set(record.store_confirmation.returned_api_versions.filter(Boolean))];
    writeOutputs(record);
    console.log("Stage 5C stopped safely.");
    console.log(`Error: ${sanitizeError(error).message}`);
    console.log("Wrote STAGE-5C-RESULT.md and generated/stage-5c-created-resources.json");
    process.exitCode = 1;
  });
}
