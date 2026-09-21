import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createAuthHandoff, consumeAuthHandoff, isValidHandoffCodeFormat } from "../lib/auth-handoff.js";
import { createFakeSupabase } from "./fake-supabase.js";

async function seedUser(supabase, shopifyCustomerId) {
  const { data } = await supabase.from("learning_users").insert({ shopify_customer_id: shopifyCustomerId });
  return data[0].id;
}

test("generates a random handoff code each time", async () => {
  const supabase = createFakeSupabase();
  const userId = await seedUser(supabase, "111000111");
  const codeA = await createAuthHandoff(supabase, userId);
  const codeB = await createAuthHandoff(supabase, userId);
  assert.notEqual(codeA, codeB);
  assert.ok(isValidHandoffCodeFormat(codeA));
  assert.ok(isValidHandoffCodeFormat(codeB));
});

test("only the SHA-256 hash of the code is persisted -- the raw code never appears in the stored row", async () => {
  const supabase = createFakeSupabase();
  const userId = await seedUser(supabase, "111000111");
  const rawCode = await createAuthHandoff(supabase, userId);

  assert.equal(supabase.tables.learning_auth_handoffs.length, 1);
  const row = supabase.tables.learning_auth_handoffs[0];
  const serializedRow = JSON.stringify(row);

  assert.ok(!serializedRow.includes(rawCode));
  assert.equal(row.code_hash, crypto.createHash("sha256").update(rawCode, "utf8").digest("hex"));
  assert.equal(row.code_hash.length, 64, "sha256 hex digest is 64 characters");
});

test("expiry is at most 2 minutes from creation", async () => {
  const supabase = createFakeSupabase();
  const userId = await seedUser(supabase, "111000111");
  const fixedNow = () => 1_700_000_000_000;
  await createAuthHandoff(supabase, userId, { now: fixedNow });

  const row = supabase.tables.learning_auth_handoffs[0];
  const ttlMs = new Date(row.expires_at).getTime() - fixedNow();
  assert.ok(ttlMs <= 2 * 60 * 1000, `expected TTL <= 120000ms, got ${ttlMs}ms`);
  assert.ok(ttlMs > 0);
});

test("a freshly created handoff exchanges successfully for the associated shopify_customer_id", async () => {
  const supabase = createFakeSupabase();
  const userId = await seedUser(supabase, "222000222");
  const rawCode = await createAuthHandoff(supabase, userId);

  const shopifyCustomerId = await consumeAuthHandoff(supabase, rawCode);
  assert.equal(shopifyCustomerId, "222000222");
});

test("an expired code is rejected", async () => {
  const supabase = createFakeSupabase();
  const userId = await seedUser(supabase, "333000333");
  const past = () => 1_700_000_000_000;
  const rawCode = await createAuthHandoff(supabase, userId, { now: past });

  // consume_learning_auth_handoff() compares expires_at against the real
  // database clock (now()), which the fake models as the real Date.now()
  // -- creating the row far in the past is equivalent to it having expired
  // by the time we consume it "now".
  const shopifyCustomerId = await consumeAuthHandoff(supabase, rawCode);
  assert.equal(shopifyCustomerId, null);
});

test("an unknown code is rejected", async () => {
  const supabase = createFakeSupabase();
  const shopifyCustomerId = await consumeAuthHandoff(supabase, "a".repeat(43));
  assert.equal(shopifyCustomerId, null);
});

test("a malformed/too-short code is rejected before any database work", async () => {
  const supabase = createFakeSupabase();
  const shopifyCustomerId = await consumeAuthHandoff(supabase, "short");
  assert.equal(shopifyCustomerId, null);
  assert.equal(supabase.tables.learning_auth_handoffs, undefined, "must not have touched the table at all");
});

test("a consumed code is rejected on a second use (replay)", async () => {
  const supabase = createFakeSupabase();
  const userId = await seedUser(supabase, "444000444");
  const rawCode = await createAuthHandoff(supabase, userId);

  const first = await consumeAuthHandoff(supabase, rawCode);
  const replay = await consumeAuthHandoff(supabase, rawCode);

  assert.equal(first, "444000444");
  assert.equal(replay, null);
});

test("two simultaneous exchanges of the same code cannot both succeed", async () => {
  const supabase = createFakeSupabase();
  const userId = await seedUser(supabase, "555000555");
  const rawCode = await createAuthHandoff(supabase, userId);

  const [resultA, resultB] = await Promise.all([consumeAuthHandoff(supabase, rawCode), consumeAuthHandoff(supabase, rawCode)]);

  const successes = [resultA, resultB].filter((value) => value !== null);
  assert.equal(successes.length, 1, "exactly one of the two concurrent exchanges must succeed");
  assert.equal(successes[0], "555000555");
});
