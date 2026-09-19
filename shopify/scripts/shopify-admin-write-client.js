import { createShopifyTokenManager } from "./shopify-admin-client.js";

const ALLOWED_STAGE_5C_MUTATIONS = new Set([
  "metaobjectDefinitionCreate",
  "metaobjectDefinitionUpdate",
  "metaobjectCreate",
  // Added for Learning Media content creation: attaching an existing
  // learning_media record to a lesson's `media` field on an already-created
  // learning_lesson entry. Upsert (not metaobjectUpdate) is used deliberately
  // -- per buildUpsertPayload's documented semantics, only the fields
  // actually provided are changed and every omitted field on the existing
  // entry is preserved untouched.
  "metaobjectUpsert",
  // Added for R02 animated-media upload: staging + registering the two
  // optimized MP4 files as Shopify Files before referencing them from
  // learning_media_item records.
  "stagedUploadsCreate",
  "fileCreate",
  // Added for the Learning Hub homepage Page route (/pages/learn): creating
  // the Page resource so the existing page.learning-hub.json theme template
  // has somewhere to attach. Deliberately does not add pageUpdate, themeCreate,
  // or themeUpdate -- this client still cannot touch an existing page/theme.
  "pageCreate",
  // Added to correct the alt text on the already-approved, already-attached
  // pre-snorkel checklist PDF (GenericFile) so the production download
  // card's title comes from real file data instead of another hardcoded
  // string. Does not touch the file's binary content or any other file.
  "fileUpdate"
]);

function stripGraphqlComments(document) {
  return String(document)
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, ""))
    .join("\n");
}

function mutationNames(document) {
  const stripped = stripGraphqlComments(document);
  if (!/\bmutation\b/i.test(stripped)) return [];
  const names = new Set();
  for (const match of stripped.matchAll(/\b(metaobjectDefinitionCreate|metaobjectCreate|metaobjectUpdate|metaobjectUpsert|metaobjectDelete|metaobjectDefinitionUpdate|metaobjectDefinitionDelete|fileCreate|fileUpdate|stagedUploadsCreate|pageCreate|pageUpdate|themeCreate|themeUpdate)\b/g)) {
    names.add(match[1]);
  }
  return [...names];
}

export function assertStage5CMutationAllowed(document) {
  const names = mutationNames(document);
  if (names.length === 0) return;
  for (const name of names) {
    if (!ALLOWED_STAGE_5C_MUTATIONS.has(name)) {
      throw new Error(`Stage 5C write client rejected mutation ${name}.`);
    }
  }
}

export function createShopifyStage5CClient(config) {
  const endpoint = `https://${config.storeDomain}/admin/api/${config.apiVersion}/graphql.json`;
  const tokenManager = createShopifyTokenManager(config);

  async function graphql(query, variables = {}, operationName = undefined) {
    assertStage5CMutationAllowed(query);
    const accessToken = await tokenManager.getAccessToken();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query, variables, operationName })
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { parseError: "Response was not valid JSON." };
    }
    return {
      ok: response.ok && !body.errors,
      status: response.status,
      actualApiVersion: response.headers.get("x-shopify-api-version"),
      body
    };
  }

  return {
    graphql,
    getAuthStatus: () => tokenManager.getAuthStatus()
  };
}
