import { buildPayloads } from "./build-shopify-payloads.js";
import { assertStage5CMutationAllowed } from "./shopify-admin-write-client.js";
import { loadDefinitions } from "./lib/learning-data.js";
import {
  assertStage5CAdminGraphqlDocuments,
  buildInitialLearningLessonDefinitionInput,
  buildRelatedLessonsFieldUpdateInput
} from "./shopify-stage-5c-create-drafts.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertMutationGuard() {
  assertStage5CMutationAllowed(`mutation { metaobjectCreate(metaobject: {type: "learning_category", handle: "test", fields: []}) { metaobject { id } } }`);
  assertStage5CMutationAllowed(`mutation { metaobjectDefinitionCreate(definition: {type: "learning_category", name: "Learning Category", fieldDefinitions: []}) { metaobjectDefinition { id } } }`);
  assertStage5CMutationAllowed(`mutation { metaobjectDefinitionUpdate(id: "gid://shopify/MetaobjectDefinition/1", definition: {fieldDefinitions: []}) { metaobjectDefinition { id } } }`);

  let rejected = false;
  try {
    assertStage5CMutationAllowed(`mutation { metaobjectUpdate(id: "gid://shopify/Metaobject/1", metaobject: {fields: []}) { metaobject { id } } }`);
  } catch {
    rejected = true;
  }
  assert(rejected, "Stage 5C mutation guard did not reject metaobjectUpdate.");
}

function assertDefinitionAccess() {
  const payloads = buildPayloads();
  const badPayloads = payloads.definitions.filter((payload) => {
    const definition = payload.variables.definition;
    return definition.type.startsWith("learning_") && definition.access && Object.prototype.hasOwnProperty.call(definition.access, "admin");
  });

  assert(badPayloads.length === 0, `Merchant-owned definition payloads must not include access.admin: ${badPayloads.map((payload) => payload.variables.definition.type).join(", ")}`);
}

function assertSelfReferenceDefinitionStrategy() {
  const definitions = loadDefinitions();
  const lessonDefinition = definitions.find((definition) => definition.type === "learning_lesson");
  const fullRelatedField = lessonDefinition.fields.find((field) => field.key === "related_lessons");
  const lessonDefinitionGid = "gid://shopify/MetaobjectDefinition/999";

  const initialInput = buildInitialLearningLessonDefinitionInput(lessonDefinition, {
    category: "gid://shopify/MetaobjectDefinition/111"
  });
  assert(!initialInput.fieldDefinitions.some((field) => field.key === "related_lessons"), "Initial learning_lesson create input must omit related_lessons.");
  assert(initialInput.fieldDefinitions.length === lessonDefinition.fields.length - 1, "Initial learning_lesson create input must omit exactly one field.");

  const updateInput = buildRelatedLessonsFieldUpdateInput(lessonDefinitionGid, lessonDefinition);
  const createOperation = updateInput.fieldDefinitions?.[0]?.create;
  assert(createOperation?.key === "related_lessons", "Self-reference update must create related_lessons.");
  assert(createOperation?.name === fullRelatedField.name, "Self-reference update must preserve related_lessons name.");
  assert(createOperation?.type === "list.metaobject_reference", "Self-reference update must preserve list.metaobject_reference.");
  assert(createOperation?.validations?.length === 1, "Self-reference update must include one validation.");
  assert(createOperation.validations[0].name === "metaobject_definition_id", "Self-reference update must use metaobject_definition_id.");
  assert(createOperation.validations[0].value === lessonDefinitionGid, "Self-reference update must use the actual learning_lesson definition GID.");
}

function main() {
  assertMutationGuard();
  assertStage5CAdminGraphqlDocuments();
  assertDefinitionAccess();
  assertSelfReferenceDefinitionStrategy();
  console.log("Stage 5C guard tests passed");
}

main();
