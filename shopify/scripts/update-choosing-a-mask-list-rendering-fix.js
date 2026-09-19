// Controlled, one-shot fix: choosing-a-mask's public page rendered
// "A Practical Mask Shortlist" as eight separate <ol><li> blocks (each
// restarting the numbering at "1.") instead of one 1-8 ordered list, because
// markdownToShopifyRichText() used to flush (close) the in-progress list on
// every blank line, and this lesson's source markdown puts a blank line
// between each numbered/bulleted item. That converter bug is now fixed
// (see lib/learning-data.js) to only end a list when a blank line is NOT
// followed by another item of the same list type. This script re-syncs ONLY
// the three fields on THIS lesson whose stored rich-text content was built
// with the old, buggy converter output (confirmed via a full audit of all
// 31 lessons' lesson_body/instructor_tips/common_mistakes/safety_notes --
// choosing-a-mask was the only one affected): lesson_body, instructor_tips,
// common_mistakes. No editorial wording changes -- same markdown source,
// only the generated rich-text structure differs. Every other field is
// omitted from the upsert so it is preserved untouched, and the lesson's
// current publish status (read fresh from Shopify, not assumed) is pinned
// explicitly so this content-only fix can never change it.
import { loadLessons, fieldPayloadValue, writeJson } from "./lib/learning-data.js";
import { createShopifyAdminClient, loadShopifyConfig, sanitizeError } from "./shopify-admin-client.js";
import { createShopifyStage5CClient } from "./shopify-admin-write-client.js";
import { userErrorsFrom } from "./shopify-stage-5c-create-drafts.js";

const REQUIRED_MYSHOPIFY_DOMAIN = "a44b34.myshopify.com";
const LESSON_HANDLE = "choosing-a-mask";
const FIELD_KEYS = ["lesson_body", "instructor_tips", "common_mistakes"];

const READ_QUERY = `#graphql
query ($handle: MetaobjectHandleInput!) {
  metaobjectByHandle(handle: $handle) {
    id
    capabilities { publishable { status } }
    fields { key value }
  }
}`;

const UPSERT_MUTATION = `#graphql
mutation ChoosingAMaskListFix($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
  metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
    metaobject { id handle capabilities { publishable { status } } fields { key value } }
    userErrors { field message code }
  }
}`;

async function main() {
  const config = loadShopifyConfig();
  if (!config.configured) throw new Error(`Shopify config incomplete: ${config.missing.join(", ")}`);
  if (config.storeDomain !== REQUIRED_MYSHOPIFY_DOMAIN) throw new Error(`Refusing unexpected store domain: ${config.storeDomain}`);

  const readClient = createShopifyAdminClient(config);
  const writeClient = createShopifyStage5CClient(config);

  const handleInput = { type: "learning_lesson", handle: LESSON_HANDLE };

  const before = await readClient.graphqlReadOnly(READ_QUERY, { handle: handleInput });
  const beforeMetaobject = before.body.data.metaobjectByHandle;
  if (!beforeMetaobject) throw new Error(`Metaobject not found for handle ${LESSON_HANDLE}`);

  const currentStatus = beforeMetaobject.capabilities?.publishable?.status;
  if (currentStatus !== "ACTIVE") {
    throw new Error(`Refusing to proceed: expected current status ACTIVE, found ${currentStatus}. Investigate before re-running.`);
  }

  const lesson = loadLessons().find((l) => l.handle === LESSON_HANDLE);
  if (!lesson) throw new Error(`${LESSON_HANDLE} not found in local generated lesson data.`);

  const fields = FIELD_KEYS.map((key) => ({
    key,
    value: fieldPayloadValue("rich_text_field", lesson.fields[key], { key })
  })).filter((field) => field.value !== null);

  const response = await writeClient.graphql(UPSERT_MUTATION, {
    handle: handleInput,
    metaobject: {
      capabilities: { publishable: { status: currentStatus } },
      fields
    }
  });

  const errors = userErrorsFrom(response, "metaobjectUpsert");
  if (!response.ok || errors.length) {
    throw new Error(`metaobjectUpsert failed: ${JSON.stringify(errors)} / ${JSON.stringify(response.body.errors ?? [])}`);
  }

  const after = response.body.data.metaobjectUpsert.metaobject;
  console.log(`Updated ${LESSON_HANDLE}: ${fields.map((f) => f.key).join(", ")}. Status preserved: ${after.capabilities.publishable.status}`);

  writeJson("generated/update-choosing-a-mask-list-rendering-fix-result.json", {
    generated_at: new Date().toISOString(),
    handle: LESSON_HANDLE,
    fields_updated: fields.map((f) => f.key),
    status_before: currentStatus,
    status_after: after.capabilities.publishable.status,
    metaobject_id: after.id
  });
}

main().catch((error) => {
  console.error("FAILED:", sanitizeError(error).message);
  process.exitCode = 1;
});
