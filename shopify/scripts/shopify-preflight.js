import fs from "node:fs";
import path from "node:path";
import {
  SHOPIFY_ROOT,
  loadDefinitions,
  writeJson
} from "./lib/learning-data.js";
import {
  createShopifyAdminClient,
  loadShopifyConfig,
  sanitizeError
} from "./shopify-admin-client.js";

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

const PLANNED_FIELD_TYPES = [
  "single_line_text_field",
  "multi_line_text_field",
  "rich_text_field",
  "number_integer",
  "date",
  "file_reference",
  "list.file_reference",
  "metaobject_reference",
  "list.metaobject_reference",
  "list.product_reference",
  "link",
  "list.link"
];

const SOURCE_URLS = [
  "https://shopify.dev/docs/apps/build/authentication-authorization",
  "https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant",
  "https://shopify.dev/docs/apps/build/authentication-authorization/manage-credentials",
  "https://shopify.dev/docs/api/usage/access-scopes",
  "https://shopify.dev/docs/apps/build/metaobjects/use-metaobject-capabilities",
  "https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions",
  "https://shopify.dev/docs/apps/build/metafields/list-of-data-types",
  "https://shopify.dev/docs/apps/build/metafields/list-of-validation-options",
  "https://shopify.dev/docs/api/admin-graphql/2026-07/queries/metafieldDefinitionTypes",
  "https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/metaobjectUpsert",
  "https://shopify.dev/docs/storefronts/themes/architecture/templates/metaobject"
];

const SHOP_IDENTITY_QUERY = `#graphql
query ShopIdentityPreflight {
  shop {
    name
    myshopifyDomain
    primaryDomain {
      host
      url
    }
    plan {
      displayName
      partnerDevelopment
      shopifyPlus
    }
  }
}`;

const SHOP_IDENTITY_FALLBACK_QUERY = `#graphql
query ShopIdentityPreflightFallback {
  shop {
    name
    myshopifyDomain
    primaryDomain {
      host
      url
    }
  }
}`;

const ACCESS_SCOPES_QUERY = `#graphql
query AccessScopesPreflight {
  currentAppInstallation {
    accessScopes {
      handle
    }
  }
}`;

const METAOBJECT_DEFINITIONS_QUERY = `#graphql
query MetaobjectDefinitionsPreflight($first: Int!, $after: String) {
  metaobjectDefinitions(first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        type
        name
        description
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

const METAOBJECT_ENTRIES_QUERY = `#graphql
query MetaobjectEntriesPreflight($type: String!, $first: Int!) {
  metaobjects(type: $type, first: $first) {
    nodes {
      id
      handle
      type
      updatedAt
      onlineStoreUrl
      capabilities {
        publishable {
          status
        }
      }
    }
  }
}`;

const LEARN_PAGE_QUERY = `#graphql
query LearnPagePreflight($query: String!) {
  pages(first: 10, query: $query) {
    nodes {
      id
      title
      handle
      isPublished
      publishedAt
      templateSuffix
    }
  }
}`;

const THEMES_QUERY = `#graphql
query ThemesPreflight {
  themes(first: 50) {
    nodes {
      id
      name
      role
    }
  }
}`;

const PRODUCT_QUERY = `#graphql
query ProductReferencePreflight($query: String!) {
  products(first: 10, query: $query) {
    nodes {
      id
      handle
      title
      status
    }
  }
}`;

const FILES_QUERY = `#graphql
query FilesPreflight {
  files(first: 5) {
    nodes {
      id
      alt
      createdAt
      fileStatus
    }
  }
}`;

const METAFIELD_TYPES_QUERY = `#graphql
query MetafieldDefinitionTypesPreflight {
  metafieldDefinitionTypes {
    name
    category
    supportsDefinitionMigrations
    supportedValidations {
      name
      type
    }
  }
}`;

const SCHEMA_INPUTS_QUERY = `#graphql
query SchemaInputsPreflight {
  metaobjectDefinitionCreateInput: __type(name: "MetaobjectDefinitionCreateInput") {
    inputFields {
      name
    }
  }
  metaobjectUpsertInput: __type(name: "MetaobjectUpsertInput") {
    inputFields {
      name
    }
  }
  queryRoot: __schema {
    queryType {
      fields {
        name
      }
    }
  }
}`;

function statusFromResponse(response) {
  if (!response) return "not_run";
  if (response.ok) return "ok";
  return "failed";
}

async function safe(label, fn) {
  try {
    const result = await fn();
    return { label, ok: true, result };
  } catch (error) {
    return { label, ok: false, error: sanitizeError(error) };
  }
}

function graphqlErrors(response) {
  return response?.body?.errors?.map((error) => error.message) ?? [];
}

async function safeGraphql(label, client, query, variables = {}) {
  const run = await safe(label, async () => client.graphqlReadOnly(query, variables));
  if (!run.ok) return run;
  return {
    label,
    ok: run.result.ok,
    result: run.result,
    errors: graphqlErrors(run.result)
  };
}

function isRelevantDefinition(definition) {
  const haystack = `${definition.type || ""} ${definition.name || ""}`.toLowerCase();
  return RELEVANT_TERMS.some((term) => haystack.includes(term.toLowerCase()));
}

function compareDefinition(existing, planned) {
  if (!planned) return { type: existing.type, planned: false };
  const existingFields = new Map((existing.fieldDefinitions || []).map((field) => [field.key, field]));
  const missingFields = planned.fields.filter((field) => !existingFields.has(field.key)).map((field) => field.key);
  const extraFields = [...existingFields.keys()].filter((key) => !planned.fields.some((field) => field.key === key));
  const typeMismatches = planned.fields
    .filter((field) => existingFields.has(field.key))
    .filter((field) => existingFields.get(field.key)?.type?.name !== field.type)
    .map((field) => ({
      key: field.key,
      planned: field.type,
      existing: existingFields.get(field.key)?.type?.name
    }));
  const requiredMismatches = planned.fields
    .filter((field) => existingFields.has(field.key))
    .filter((field) => Boolean(existingFields.get(field.key)?.required) !== Boolean(field.required))
    .map((field) => ({
      key: field.key,
      planned: Boolean(field.required),
      existing: Boolean(existingFields.get(field.key)?.required)
    }));

  return {
    type: existing.type,
    planned: true,
    missingFields,
    extraFields,
    typeMismatches,
    requiredMismatches,
    capabilitiesMatch: {
      publishable: Boolean(existing.capabilities?.publishable?.enabled) === Boolean(planned.capabilities?.publishable?.enabled),
      renderable: Boolean(existing.capabilities?.renderable?.enabled) === Boolean(planned.capabilities?.renderable?.enabled),
      onlineStore: Boolean(existing.capabilities?.onlineStore?.enabled) === Boolean(planned.capabilities?.onlineStore?.enabled)
    },
    plannedUrlHandle: planned.capabilities?.onlineStore?.data?.urlHandle,
    existingUrlHandle: existing.capabilities?.onlineStore?.data?.urlHandle
  };
}

async function loadAllDefinitions(client) {
  const all = [];
  let after = null;
  for (let page = 0; page < 10; page += 1) {
    const response = await client.graphqlReadOnly(METAOBJECT_DEFINITIONS_QUERY, { first: 100, after });
    if (!response.ok) {
      return {
        ok: false,
        actualApiVersion: response.actualApiVersion,
        errors: graphqlErrors(response),
        status: response.status,
        definitions: all
      };
    }
    const connection = response.body.data.metaobjectDefinitions;
    all.push(...connection.edges.map((edge) => edge.node));
    if (!connection.pageInfo.hasNextPage) {
      return {
        ok: true,
        actualApiVersion: response.actualApiVersion,
        definitions: all
      };
    }
    after = connection.pageInfo.endCursor;
  }
  return {
    ok: true,
    definitions: all,
    warning: "Stopped after 10 pages of metaobject definitions."
  };
}

function intendedStoreConfirmed(shop) {
  if (!shop) return false;
  const text = `${shop.name || ""} ${shop.myshopifyDomain || ""} ${shop.primaryDomain?.host || ""}`.toLowerCase();
  return text.includes("ocean") && text.includes("optic");
}

function apiVersionConfirmed(actualVersions, requiredVersion) {
  const concrete = actualVersions.filter(Boolean);
  return concrete.length > 0 && concrete.every((version) => version === requiredVersion);
}

function collectActualVersions(...responses) {
  return responses
    .flat()
    .map((response) => response?.actualApiVersion || response?.result?.actualApiVersion)
    .filter(Boolean);
}

function scopeHandles(scopeResult) {
  return scopeResult?.result?.body?.data?.currentAppInstallation?.accessScopes?.map((scope) => scope.handle).sort() ?? [];
}

function requiredScopes(availableScopes) {
  const preflightRead = [
    "read_metaobject_definitions",
    "read_metaobjects",
    "read_online_store_pages",
    "read_themes",
    "read_products",
    "read_files"
  ];
  const stage5CMinimum = [
    "write_metaobject_definitions",
    "write_metaobjects"
  ];
  const laterIfRequired = ["write_files"];
  return {
    preflightRead,
    missingPreflightRead: preflightRead.filter((scope) => !availableScopes.includes(scope)),
    stage5CMinimum,
    laterIfRequired,
    missingStage5CMinimum: stage5CMinimum.filter((scope) => !availableScopes.includes(scope)),
    missingLaterIfRequired: laterIfRequired.filter((scope) => !availableScopes.includes(scope)),
    note: "Stage 5B should use read scopes only. Stage 5C writes later need metaobject write scopes; file writes should be added only if upload automation is required. Theme development should use Shopify CLI or a separately scoped theme workflow rather than automatically broadening this Admin API credential."
  };
}

function legacyRequiredScopesForMarkdown(scopeReport) {
  return {
    minimum: scopeReport.stage5CMinimum,
    likelyLater: scopeReport.laterIfRequired,
    missingMinimum: scopeReport.missingStage5CMinimum,
    missingLikelyLater: scopeReport.missingLaterIfRequired,
    note: scopeReport.note
  };
}

function compatibleFieldTypes(typeResult) {
  const types = typeResult?.result?.body?.data?.metafieldDefinitionTypes ?? [];
  const names = new Set(types.map((type) => type.name));
  return PLANNED_FIELD_TYPES.map((type) => ({
    type,
    supported: names.has(type),
    supportedValidations: types.find((entry) => entry.name === type)?.supportedValidations ?? []
  }));
}

function schemaCompatibility(typeResult, schemaInputsResult) {
  const fieldTypes = compatibleFieldTypes(typeResult);
  const schemaData = schemaInputsResult?.result?.body?.data;
  return {
    checkedAgainstLiveApi: Boolean(typeResult?.ok && schemaInputsResult?.ok),
    plannedFieldTypes: fieldTypes,
    missingFieldTypes: fieldTypes.filter((entry) => !entry.supported).map((entry) => entry.type),
    definitionInputFields: schemaData?.metaobjectDefinitionCreateInput?.inputFields?.map((field) => field.name) ?? [],
    upsertInputFields: schemaData?.metaobjectUpsertInput?.inputFields?.map((field) => field.name) ?? [],
    queryRootHasMetafieldDefinitionTypes: Boolean(schemaData?.queryRoot?.queryType?.fields?.some((field) => field.name === "metafieldDefinitionTypes")),
    queryRootHasMetaobjectDefinitions: Boolean(schemaData?.queryRoot?.queryType?.fields?.some((field) => field.name === "metaobjectDefinitions"))
  };
}

function referenceValidationSyntax() {
  return {
    plannedDefinitionOwnership: "merchant-owned metaobject definitions with simple type names",
    recommendation: "In Stage 5C, create/read category and lesson definitions first, then prefer metaobject_definition_id validations using returned definition GIDs. If using type-based validations, use the exact runtime definition type string.",
    graphqlById: {
      name: "metaobject_definition_id",
      lessonToCategoryValue: "gid://shopify/MetaobjectDefinition/{learning_category_definition_id}",
      lessonToRelatedLessonsValue: "gid://shopify/MetaobjectDefinition/{learning_lesson_definition_id}",
      pathwayToOrderedLessonsValue: "gid://shopify/MetaobjectDefinition/{learning_lesson_definition_id}"
    },
    graphqlByType: {
      name: "metaobject_definition_type",
      lessonToCategoryValue: "learning_category",
      lessonToRelatedLessonsValue: "learning_lesson",
      pathwayToOrderedLessonsValue: "learning_lesson"
    },
    docs: "Shopify GraphQL validation options support metaobject_definition_id or metaobject_definition_type for metaobject_reference and list.metaobject_reference."
  };
}

function docsOnlyConfirmation() {
  return {
    upsertBehavior: {
      confirmedFromDocs: true,
      summary: "metaobjectUpsert creates or updates by handle. With the metaobject input, only supplied fields are updated and omitted fields are preserved. The values argument is a full replacement and clears omitted keys."
    },
    draftBehavior: {
      confirmedFromDocs: true,
      summary: "The publishable capability supports DRAFT and ACTIVE. Stage 5C should create all pilot lessons, categories, and pathways as DRAFT until templates and review gates are ready."
    },
    onlineStoreBehavior: {
      confirmedFromDocs: true,
      summary: "onlineStore assigns URL handling for metaobject pages using /pages/{urlHandle}/{entry-handle}; learning_lesson uses urlHandle learn."
    },
    linkValueShape: {
      confirmedFromDocs: true,
      summary: "link and list.link fields store text and URL JSON pairings."
    }
  };
}

async function inspectEntries(client, definitions) {
  const entries = [];
  for (const definition of definitions) {
    const response = await safeGraphql(`entries:${definition.type}`, client, METAOBJECT_ENTRIES_QUERY, {
      type: definition.type,
      first: 50
    });
    const errors = response.errors?.length ? response.errors : response.error ? [response.error.message] : [];
    entries.push({
      type: definition.type,
      status: statusFromResponse(response.result),
      errors,
      entries: response.result?.body?.data?.metaobjects?.nodes ?? []
    });
  }
  return entries;
}

async function inspectTheme(client, availableScopes) {
  const themeQuery = await safeGraphql("themes", client, THEMES_QUERY);
  const themeReport = {
    graphqlStatus: statusFromResponse(themeQuery.result),
    graphqlErrors: themeQuery.errors ?? [],
    liveThemeName: null,
    liveThemeId: null,
    developmentOrUnpublishedThemes: [],
    hasMetaobjectTemplatesFolder: null,
    learningOrGuideAssets: [],
    note: null
  };

  let themes = themeQuery.result?.body?.data?.themes?.nodes ?? [];

  if (!themes.length && availableScopes.includes("read_themes")) {
    const restThemes = await safe("themes-rest", async () => client.restGet("/themes.json"));
    if (restThemes.ok && restThemes.result.ok) {
      themes = restThemes.result.body.themes ?? [];
      themeReport.restStatus = "ok";
    } else {
      themeReport.restStatus = "failed";
      themeReport.restErrors = restThemes.error ? [restThemes.error.message] : restThemes.result?.body?.errors;
    }
  }

  const liveTheme = themes.find((theme) => String(theme.role).toUpperCase() === "MAIN") ?? null;
  themeReport.liveThemeName = liveTheme?.name ?? null;
  themeReport.liveThemeId = liveTheme?.id ?? null;
  themeReport.developmentOrUnpublishedThemes = themes
    .filter((theme) => String(theme.role).toUpperCase() !== "MAIN")
    .map((theme) => ({ id: theme.id, name: theme.name, role: theme.role }));

  if (!availableScopes.includes("read_themes")) {
    themeReport.note = "read_themes scope not available or not reported; theme asset inspection skipped.";
    return themeReport;
  }

  if (!liveTheme) {
    themeReport.note = "No live theme was readable through the current credentials.";
    return themeReport;
  }

  const numericThemeId = String(liveTheme.id).split("/").pop();
  const assets = await safe("theme-assets", async () => client.restGet(`/themes/${numericThemeId}/assets.json?fields=key`));
  if (!assets.ok || !assets.result.ok) {
    themeReport.assetStatus = "failed";
    themeReport.assetErrors = assets.error ? [assets.error.message] : assets.result?.body?.errors;
    return themeReport;
  }

  const keys = (assets.result.body.assets ?? []).map((asset) => asset.key);
  themeReport.assetStatus = "ok";
  themeReport.hasMetaobjectTemplatesFolder = keys.some((key) => key.startsWith("templates/metaobject/"));
  themeReport.learningOrGuideAssets = keys.filter((key) => /learning|learn|guide|education|academy/i.test(key));
  return themeReport;
}

function markdownList(items, empty = "_None._") {
  if (!items || items.length === 0) return empty;
  return items.map((item) => `- ${item}`).join("\n");
}

function asCode(value) {
  if (value === null || value === undefined || value === "") return "`not available`";
  return `\`${String(value).replace(/`/g, "\\`")}\``;
}

function writeMarkdownReport(report) {
  const lines = [];
  lines.push("# Stage 5B Shopify Read-Only Preflight");
  lines.push("");
  lines.push(`Generated at: ${report.generated_at}`);
  lines.push("");
  lines.push("Stage 5B is read-only. This report contains no access tokens and no mutations were executed.");
  lines.push("");
  lines.push("Authentication prefers Shopify's client credentials grant for server-side integrations acting on stores in the same Shopify organization. A legacy Admin API access token is supported only as a fallback for an existing legacy custom app.");
  lines.push("");
  lines.push("## Connection");
  lines.push("");
  lines.push(`- Authentication method: ${asCode(report.authentication.method)}`);
  lines.push(`- Authentication succeeded: ${report.authentication.succeeded ? "YES" : "NO"}`);
  lines.push(`- Client credentials preferred: ${report.authentication.client_credentials_preferred ? "YES" : "NO"}`);
  lines.push(`- Legacy token fallback used: ${report.authentication.legacy_token_fallback_used ? "YES" : "NO"}`);
  lines.push(`- Intended store confirmed: ${report.connection.intended_store_confirmed ? "YES" : "NO"}`);
  lines.push(`- API version confirmed: ${report.connection.api_version_confirmed ? "YES" : "NO"}`);
  lines.push(`- Requested API version: ${asCode(report.connection.requested_api_version)}`);
  lines.push(`- Actual API versions returned: ${report.connection.actual_api_versions.length ? report.connection.actual_api_versions.map(asCode).join(", ") : "`not available`"}`);
  lines.push(`- Shop name: ${asCode(report.connection.shop?.name)}`);
  lines.push(`- Primary domain: ${asCode(report.connection.shop?.primaryDomain?.host || report.connection.shop?.primaryDomain?.url)}`);
  lines.push(`- MyShopify domain: ${asCode(report.connection.shop?.myshopifyDomain)}`);
  lines.push(`- Shopify plan: ${asCode(report.connection.shop?.plan?.displayName)}`);
  lines.push("");
  lines.push("## Existing Definitions");
  lines.push("");
  if (report.existing_definitions.relevant.length) {
    for (const definition of report.existing_definitions.relevant) {
      lines.push(`### ${definition.type}`);
      lines.push("");
      lines.push(`- ID: ${asCode(definition.id)}`);
      lines.push(`- Name: ${asCode(definition.name)}`);
      lines.push(`- Access: ${asCode(JSON.stringify(definition.access ?? null))}`);
      lines.push(`- Capabilities: ${asCode(JSON.stringify(definition.capabilities ?? null))}`);
      lines.push(`- Online Store URL handle: ${asCode(definition.capabilities?.onlineStore?.data?.urlHandle)}`);
      lines.push(`- Renderable settings: ${asCode(JSON.stringify(definition.capabilities?.renderable ?? null))}`);
      lines.push(`- Publishable settings: ${asCode(JSON.stringify(definition.capabilities?.publishable ?? null))}`);
      lines.push("");
      lines.push("Field definitions:");
      lines.push("");
      lines.push(markdownList((definition.fieldDefinitions ?? []).map((field) => `${field.key}: ${field.type?.name}${field.required ? " (required)" : ""}`)));
      lines.push("");
      lines.push("Stage 5A comparison:");
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(report.existing_definitions.comparisons.find((item) => item.type === definition.type) ?? {}, null, 2));
      lines.push("```");
      lines.push("");
    }
  } else {
    lines.push(report.existing_definitions.status === "ok" ? "_No relevant definitions found._" : "_Definitions could not be read._");
    if (report.existing_definitions.errors?.length) lines.push(markdownList(report.existing_definitions.errors));
    lines.push("");
  }
  lines.push("## Existing Entries");
  lines.push("");
  if (report.existing_entries.length) {
    for (const group of report.existing_entries) {
      lines.push(`### ${group.type}`);
      lines.push("");
      if (group.entries.length) {
        lines.push(markdownList(group.entries.map((entry) => `${entry.handle} - ${entry.capabilities?.publishable?.status || "status unavailable"} - ${entry.onlineStoreUrl || "URL unavailable"}`)));
      } else {
        lines.push("_No entries found or entries unavailable._");
      }
      lines.push("");
    }
  } else {
    lines.push("_No relevant entries inspected._");
    lines.push("");
  }
  lines.push("## `/pages/learn` Status");
  lines.push("");
  if (report.learn_page.status === "ok" && report.learn_page.pages.length) {
    lines.push(markdownList(report.learn_page.pages.map((page) => `${page.title} - handle ${page.handle} - published ${page.isPublished} - template ${page.templateSuffix || "default"}`)));
  } else if (report.learn_page.status === "ok") {
    lines.push("_No Shopify Page with handle `learn` found._");
  } else {
    lines.push("_Page check unavailable._");
    if (report.learn_page.errors?.length) lines.push(markdownList(report.learn_page.errors));
  }
  lines.push("");
  lines.push("## Theme Status");
  lines.push("");
  lines.push(`- Live theme name: ${asCode(report.theme.liveThemeName)}`);
  lines.push(`- Live theme ID: ${asCode(report.theme.liveThemeId)}`);
  lines.push(`- Development/unpublished themes: ${report.theme.developmentOrUnpublishedThemes?.length ?? 0}`);
  lines.push(`- Contains templates/metaobject/: ${report.theme.hasMetaobjectTemplatesFolder === null ? "not available" : report.theme.hasMetaobjectTemplatesFolder ? "YES" : "NO"}`);
  lines.push("");
  lines.push("Learning/guide-related theme assets:");
  lines.push("");
  lines.push(markdownList(report.theme.learningOrGuideAssets));
  if (report.theme.note) {
    lines.push("");
    lines.push(`Note: ${report.theme.note}`);
  }
  lines.push("");
  lines.push("## Available Scopes");
  lines.push("");
  lines.push(markdownList(report.available_scopes.map((scope) => `\`${scope}\``), "_Scopes unavailable._"));
  lines.push("");
  lines.push("## Required Stage 5B Preflight Read Scopes");
  lines.push("");
  lines.push(markdownList(report.required_scopes.preflightRead.map((scope) => `\`${scope}\``)));
  lines.push("");
  lines.push("Missing Stage 5B read scopes from current connection:");
  lines.push(markdownList(report.required_scopes.missingPreflightRead.map((scope) => `\`${scope}\``)));
  lines.push("");
  lines.push("## Required Stage 5C Scopes");
  lines.push("");
  lines.push("Minimum:");
  lines.push(markdownList(report.required_scopes.stage5CMinimum.map((scope) => `\`${scope}\``)));
  lines.push("");
  lines.push("Missing minimum from current connection:");
  lines.push(markdownList(report.required_scopes.missingStage5CMinimum.map((scope) => `\`${scope}\``)));
  lines.push("");
  lines.push("Later only if required:");
  lines.push(markdownList(report.required_scopes.laterIfRequired.map((scope) => `\`${scope}\``)));
  lines.push("");
  lines.push(report.required_scopes.note);
  lines.push("");
  lines.push("## Stage 5A Schema Compatibility");
  lines.push("");
  lines.push(`- Checked against live API: ${report.schema_compatibility.checkedAgainstLiveApi ? "YES" : "NO"}`);
  lines.push(`- Missing planned field types: ${report.schema_compatibility.missingFieldTypes.length ? report.schema_compatibility.missingFieldTypes.join(", ") : "none reported"}`);
  lines.push("");
  lines.push("Planned field type support:");
  lines.push("");
  lines.push(markdownList(report.schema_compatibility.plannedFieldTypes?.map((entry) => `${entry.type}: ${entry.supported ? "supported" : "not confirmed"}`)));
  lines.push("");
  lines.push("## Reference Validation Syntax");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(report.reference_validation_syntax, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Upsert Behavior Confirmation");
  lines.push("");
  lines.push(report.documentation_confirmation.upsertBehavior.summary);
  lines.push("");
  lines.push("## Publication/Draft Behavior Confirmation");
  lines.push("");
  lines.push(report.documentation_confirmation.draftBehavior.summary);
  lines.push("");
  lines.push("## Blocking Issues");
  lines.push("");
  lines.push(markdownList(report.blocking_issues));
  lines.push("");
  lines.push("## Warnings");
  lines.push("");
  lines.push(markdownList(report.warnings));
  lines.push("");
  lines.push("## Safe to Proceed to Stage 5C?");
  lines.push("");
  lines.push(report.safe_to_proceed_to_stage_5c ? "YES" : "NO");
  lines.push("");
  lines.push(report.safe_to_proceed_explanation);
  lines.push("");
  lines.push("## Official Sources");
  lines.push("");
  lines.push(markdownList(report.official_sources));
  lines.push("");

  fs.writeFileSync(path.join(SHOPIFY_ROOT, "STAGE-5B-PREFLIGHT.md"), `${lines.join("\n")}\n`);
}

function unauthenticatedReport(config, reason) {
  const blockingIssues = [];
  if (config.missing.length) blockingIssues.push(`Authentication is not configured. Missing: ${config.missing.join(", ")}.`);
  if (!config.apiVersionMatchesRequirement) blockingIssues.push(`SHOPIFY_API_VERSION must be 2026-07, found ${config.apiVersion}.`);
  if (reason) blockingIssues.push(reason);
  const scopeReport = requiredScopes([]);

  return {
    generated_at: new Date().toISOString(),
    mode: "read_only_preflight",
    network_requests_attempted: false,
    mutation_guard_enabled: true,
    official_sources: SOURCE_URLS,
    authentication: {
      method: config.authMode,
      succeeded: false,
      client_credentials_preferred: true,
      legacy_token_fallback_used: false,
      token_stored_in_reports: false,
      token_stored_on_disk: false
    },
    connection: {
      intended_store_confirmed: false,
      api_version_confirmed: false,
      requested_api_version: config.apiVersion,
      actual_api_versions: [],
      shop: null
    },
    existing_definitions: { status: "not_run", relevant: [], comparisons: [], errors: [] },
    existing_entries: [],
    learn_page: { status: "not_run", pages: [], errors: [] },
    theme: {
      graphqlStatus: "not_run",
      liveThemeName: null,
      liveThemeId: null,
      developmentOrUnpublishedThemes: [],
      hasMetaobjectTemplatesFolder: null,
      learningOrGuideAssets: [],
      note: "Theme check not run because authentication is not configured."
    },
    reference_resolution: {
      products: { status: "not_run", nodes: [] },
      files: { status: "not_run", nodes: [] },
      tools: { status: "not_run", note: "No canonical local URLs found or checked." }
    },
    available_scopes: [],
    required_scopes: scopeReport,
    required_stage_5c_scopes: legacyRequiredScopesForMarkdown(scopeReport),
    schema_compatibility: {
      checkedAgainstLiveApi: false,
      plannedFieldTypes: PLANNED_FIELD_TYPES.map((type) => ({ type, supported: false, supportedValidations: [] })),
      missingFieldTypes: PLANNED_FIELD_TYPES,
      note: "Live API schema compatibility was not checked because authentication is not configured."
    },
    reference_validation_syntax: referenceValidationSyntax(),
    documentation_confirmation: docsOnlyConfirmation(),
    blocking_issues: blockingIssues,
    warnings: ["Add a local /shopify/.env file from /shopify/.env.example to run the authenticated read-only preflight. Prefer SHOPIFY_CLIENT_ID plus SHOPIFY_CLIENT_SECRET; use SHOPIFY_ADMIN_ACCESS_TOKEN only as a legacy fallback."],
    safe_to_proceed_to_stage_5c: false,
    safe_to_proceed_explanation: "NO. Stage 5B has not confirmed the intended store or API version yet."
  };
}

async function authenticatedReport(config) {
  const client = createShopifyAdminClient(config);
  const warnings = [];
  const blockingIssues = [];
  const plannedDefinitions = loadDefinitions();
  const plannedByType = new Map(plannedDefinitions.map((definition) => [definition.type, definition]));

  const shopRun = await safeGraphql("shop", client, SHOP_IDENTITY_QUERY);
  let shop = shopRun.result?.body?.data?.shop ?? null;
  if (!shopRun.ok) {
    warnings.push(`Primary shop identity query failed: ${(shopRun.errors ?? []).join("; ") || "unknown error"}. Trying fallback.`);
    const fallbackRun = await safeGraphql("shop-fallback", client, SHOP_IDENTITY_FALLBACK_QUERY);
    shop = fallbackRun.result?.body?.data?.shop ?? null;
    if (!fallbackRun.ok) blockingIssues.push(`Shop identity check failed: ${(fallbackRun.errors ?? []).join("; ") || fallbackRun.error?.message || "unknown error"}.`);
  }

  const scopesRun = await safeGraphql("access-scopes", client, ACCESS_SCOPES_QUERY);
  const availableScopes = scopeHandles(scopesRun);
  if (!scopesRun.ok) warnings.push(`Access scope query failed: ${(scopesRun.errors ?? []).join("; ") || scopesRun.error?.message || "unknown error"}.`);

  const definitionsRun = await safe("definitions", async () => loadAllDefinitions(client));
  const allDefinitions = definitionsRun.result?.definitions ?? [];
  const relevantDefinitions = allDefinitions.filter(isRelevantDefinition);
  if (!definitionsRun.ok || definitionsRun.result?.ok === false) {
    warnings.push(`Metaobject definition query failed: ${definitionsRun.error?.message || (definitionsRun.result?.errors ?? []).join("; ") || "unknown error"}.`);
  }

  const comparisons = relevantDefinitions.map((definition) => compareDefinition(definition, plannedByType.get(definition.type)));
  const existingEntries = await inspectEntries(client, relevantDefinitions);

  const learnPageRun = await safeGraphql("learn-page", client, LEARN_PAGE_QUERY, { query: "handle:learn" });
  const learnPage = {
    status: statusFromResponse(learnPageRun.result),
    errors: learnPageRun.errors ?? [],
    pages: learnPageRun.result?.body?.data?.pages?.nodes ?? []
  };
  if (learnPage.status !== "ok") warnings.push("Could not inspect Shopify Page handle `learn` with current credentials/query.");

  const theme = await inspectTheme(client, availableScopes);
  if (theme.graphqlStatus !== "ok" && theme.restStatus !== "ok") warnings.push("Theme status could not be fully inspected with current credentials/query.");

  const productRun = await safeGraphql("product-reference", client, PRODUCT_QUERY, { query: "handle:prescription-mask-collection" });
  const fileRun = await safeGraphql("files", client, FILES_QUERY);
  const typeRun = await safeGraphql("metafield-definition-types", client, METAFIELD_TYPES_QUERY);
  const schemaInputsRun = await safeGraphql("schema-inputs", client, SCHEMA_INPUTS_QUERY);
  const schema = schemaCompatibility(typeRun, schemaInputsRun);
  const scopeReport = requiredScopes(availableScopes);

  if (!productRun.ok) warnings.push(`Product read preflight failed: ${(productRun.errors ?? []).join("; ") || productRun.error?.message || "unknown error"}.`);
  if (!fileRun.ok) warnings.push(`Files read preflight failed: ${(fileRun.errors ?? []).join("; ") || fileRun.error?.message || "unknown error"}.`);
  if (!typeRun.ok) warnings.push(`Metafield definition type query failed: ${(typeRun.errors ?? []).join("; ") || typeRun.error?.message || "unknown error"}.`);
  if (!schemaInputsRun.ok) warnings.push(`Schema introspection query failed: ${(schemaInputsRun.errors ?? []).join("; ") || schemaInputsRun.error?.message || "unknown error"}.`);

  if (productRun.ok && (productRun.result?.body?.data?.products?.nodes ?? []).length === 0) {
    warnings.push("No product with handle `prescription-mask-collection` was found. This may be a collection or unresolved placeholder rather than a product handle.");
  }

  const actualApiVersions = collectActualVersions(
    shopRun,
    scopesRun,
    definitionsRun.result,
    learnPageRun,
    productRun,
    fileRun,
    typeRun,
    schemaInputsRun
  );
  const apiConfirmed = apiVersionConfirmed(actualApiVersions, config.requiredApiVersion);
  const storeConfirmed = intendedStoreConfirmed(shop);

  if (!apiConfirmed) blockingIssues.push("The Shopify response headers did not confirm API version 2026-07 for every completed request.");
  if (!storeConfirmed) blockingIssues.push("The connected store did not clearly match Oceans Optics by shop name or domain.");
  if (schema.missingFieldTypes.length) blockingIssues.push(`Live API did not confirm planned field types: ${schema.missingFieldTypes.join(", ")}.`);
  if (scopeReport.missingPreflightRead.length) warnings.push(`Current connection is missing Stage 5B read scopes: ${scopeReport.missingPreflightRead.join(", ")}.`);

  return {
    generated_at: new Date().toISOString(),
    mode: "read_only_preflight",
    network_requests_attempted: true,
    mutation_guard_enabled: true,
    official_sources: SOURCE_URLS,
    authentication: {
      method: config.authMode,
      succeeded: client.getAuthStatus().succeeded,
      client_credentials_preferred: true,
      legacy_token_fallback_used: config.authMode === "legacy_admin_access_token",
      token_stored_in_reports: false,
      token_stored_on_disk: false
    },
    connection: {
      intended_store_confirmed: storeConfirmed,
      api_version_confirmed: apiConfirmed,
      requested_api_version: config.apiVersion,
      actual_api_versions: [...new Set(actualApiVersions)],
      shop
    },
    existing_definitions: {
      status: definitionsRun.result?.ok ? "ok" : "failed",
      totalRead: allDefinitions.length,
      relevant: relevantDefinitions,
      comparisons,
      errors: definitionsRun.result?.errors ?? []
    },
    existing_entries: existingEntries,
    learn_page: learnPage,
    theme,
    reference_resolution: {
      products: {
        status: statusFromResponse(productRun.result),
        errors: productRun.errors ?? [],
        nodes: productRun.result?.body?.data?.products?.nodes ?? []
      },
      files: {
        status: statusFromResponse(fileRun.result),
        errors: fileRun.errors ?? [],
        nodes: fileRun.result?.body?.data?.files?.nodes ?? []
      },
      tools: {
        status: "not_resolved",
        note: "Tools may be normal URLs. No canonical local URL was found or invented in Stage 5B."
      }
    },
    available_scopes: availableScopes,
    required_scopes: scopeReport,
    required_stage_5c_scopes: legacyRequiredScopesForMarkdown(scopeReport),
    schema_compatibility: schema,
    reference_validation_syntax: referenceValidationSyntax(),
    documentation_confirmation: docsOnlyConfirmation(),
    blocking_issues: blockingIssues,
    warnings,
    safe_to_proceed_to_stage_5c: blockingIssues.length === 0,
    safe_to_proceed_explanation: blockingIssues.length === 0
      ? "YES. Read-only preflight did not find blocking issues. Stage 5C writes should still begin with DRAFT entries only."
      : "NO. Resolve the blocking issues before any Stage 5C write operation."
  };
}

async function main() {
  const config = loadShopifyConfig();
  let report;

  if (!config.configured || !config.apiVersionMatchesRequirement) {
    report = unauthenticatedReport(config);
  } else {
    report = await authenticatedReport(config);
  }

  writeJson("generated/shopify-preflight-report.json", report);
  writeMarkdownReport(report);

  console.log("Shopify Stage 5B preflight");
  console.log(`Read-only mode: ${report.mode === "read_only_preflight" ? "enabled" : "unknown"}`);
  console.log(`Network requests attempted: ${report.network_requests_attempted ? "yes" : "no"}`);
  console.log(`Authentication method: ${report.authentication.method}`);
  console.log(`Authentication succeeded: ${report.authentication.succeeded ? "YES" : "NO"}`);
  console.log(`Intended store confirmed: ${report.connection.intended_store_confirmed ? "YES" : "NO"}`);
  console.log(`API version confirmed: ${report.connection.api_version_confirmed ? "YES" : "NO"}`);
  console.log(`Blocking issues: ${report.blocking_issues.length}`);
  console.log(`Warnings: ${report.warnings.length}`);
  console.log(`Safe to proceed to Stage 5C: ${report.safe_to_proceed_to_stage_5c ? "YES" : "NO"}`);
  console.log("Wrote STAGE-5B-PREFLIGHT.md and generated/shopify-preflight-report.json");
}

main().catch((error) => {
  const config = loadShopifyConfig();
  const report = unauthenticatedReport(config, `Preflight failed safely: ${sanitizeError(error).message}`);
  writeJson("generated/shopify-preflight-report.json", report);
  writeMarkdownReport(report);
  console.log("Shopify Stage 5B preflight failed safely.");
  console.log("No mutations were executed.");
  console.log("Wrote STAGE-5B-PREFLIGHT.md and generated/shopify-preflight-report.json");
});
