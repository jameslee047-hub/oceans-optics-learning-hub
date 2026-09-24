// Proves the privacy/security properties specifically required for the
// Shopify learner identity lookup: nothing it resolves is ever written back
// to Supabase, anonymous visitors are structurally excluded from it, and no
// Shopify Admin access token ever appears in what it hands back to a route
// (and therefore to the browser). Route-level admin-auth gating itself is
// unchanged by this feature and is already covered by test/admin-routes.test.js
// -- these tests exercise the real exported functions composed the same way
// routes/admin/learners.js and routes/admin/learners/[id].js compose them,
// against the fake Supabase's actual stored table state (see
// test/fake-supabase.js), since getSupabaseClient() itself requires a real
// Supabase project and cannot be swapped in a route-level test (the same
// boundary test/admin-routes.test.js already documents).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeSupabase } from "./fake-supabase.js";
import { computeLearnerTable, LEARNING_CATALOGUE } from "../lib/analytics-service.js";
import { resolveShopifyIdentities, buildLearnerIdentity } from "../lib/learner-identity.js";

const CONFIGURED = {
  configured: true,
  authMode: "client_credentials",
  shopDomain: "a44b34.myshopify.com",
  clientId: "client-id",
  clientSecret: "client-secret",
  apiVersion: "2026-07"
};

function fakeShopifyFetch(mintedToken, customers) {
  return async (url, options) => {
    if (url.includes("/admin/oauth/access_token")) {
      return { ok: true, json: async () => ({ access_token: mintedToken, expires_in: 3600 }) };
    }
    const body = JSON.parse(options.body);
    assert.equal(options.headers["X-Shopify-Access-Token"], mintedToken, "the minted token must be sent as the header, not embedded in the body");
    const ids = body.variables.ids.map((gid) => gid.replace("gid://shopify/Customer/", ""));
    const nodes = ids
      .filter((id) => customers[id])
      .map((id) => ({ id: `gid://shopify/Customer/${id}`, displayName: customers[id].displayName, email: customers[id].email }));
    return { ok: true, json: async () => ({ data: { nodes } }) };
  };
}

test("privacy: enriching learners with a resolved Shopify identity never writes display_name/email back into the learning_users table", async () => {
  const supabase = createFakeSupabase();
  await supabase.from("learning_users").insert({ shopify_customer_id: "111", created_at: "2026-01-01T00:00:00Z", last_seen_at: "2026-01-01T00:00:00Z" });
  await supabase.from("learning_users").insert({ shopify_customer_id: "222", created_at: "2026-01-01T00:00:00Z", last_seen_at: "2026-01-01T00:00:00Z" });

  const { data: users } = await supabase.from("learning_users").select("id, shopify_customer_id, created_at, last_seen_at");
  const learners = computeLearnerTable(LEARNING_CATALOGUE, users, [], []);

  const fetchImpl = fakeShopifyFetch("minted-admin-token", {
    111: { displayName: "James Lee", email: "james@example.com" },
    222: { displayName: "Ada Lovelace", email: "ada@example.com" }
  });
  const resolved = await resolveShopifyIdentities(
    learners.map((l) => l.shopify_customer_id),
    { getConfig: () => CONFIGURED, fetchImpl }
  );
  const enriched = learners.map((learner) => ({ ...learner, ...buildLearnerIdentity(learner.shopify_customer_id, resolved, CONFIGURED.shopDomain) }));

  // The enriched, outgoing response DOES carry the resolved name/email.
  assert.equal(enriched.find((l) => l.shopify_customer_id === "111").display_name, "James Lee");
  assert.equal(enriched.find((l) => l.shopify_customer_id === "222").email, "ada@example.com");

  // But the underlying Supabase rows are completely untouched: same two
  // rows, no display_name/email/name columns added to either.
  const rows = supabase.tables.learning_users;
  assert.equal(rows.length, 2);
  rows.forEach((row) => {
    const keys = Object.keys(row).sort();
    assert.deepEqual(keys, ["created_at", "id", "last_seen_at", "shopify_customer_id"]);
    assert.equal(row.display_name, undefined);
    assert.equal(row.email, undefined);
    assert.equal(row.name, undefined);
  });
});

test("privacy: a Shopify lookup failure never mutates or blocks reading the existing learning_users rows", async () => {
  const supabase = createFakeSupabase();
  await supabase.from("learning_users").insert({ shopify_customer_id: "111", created_at: "2026-01-01T00:00:00Z", last_seen_at: "2026-01-01T00:00:00Z" });
  const { data: users } = await supabase.from("learning_users").select("id, shopify_customer_id, created_at, last_seen_at");
  const learners = computeLearnerTable(LEARNING_CATALOGUE, users, [], []);

  const resolved = await resolveShopifyIdentities(
    learners.map((l) => l.shopify_customer_id),
    { getConfig: () => CONFIGURED, fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) }
  );
  const enriched = learners.map((learner) => ({ ...learner, ...buildLearnerIdentity(learner.shopify_customer_id, resolved, CONFIGURED.shopDomain) }));

  assert.equal(enriched[0].display_name, null);
  assert.equal(enriched[0].fallback_label, "Customer #111");
  assert.equal(supabase.tables.learning_users.length, 1, "the row must still be readable/unaffected after a Shopify failure");
});

test("privacy: anonymous visitor identities never appear in the enriched learner list -- only rows already in learning_users can be enriched", async () => {
  const supabase = createFakeSupabase();
  await supabase.from("learning_users").insert({ shopify_customer_id: "111", created_at: "2026-01-01T00:00:00Z", last_seen_at: "2026-01-01T00:00:00Z" });
  // Anonymous activity recorded in learning_events, never in learning_users.
  await supabase.from("learning_events").insert({ anonymous_visitor_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", event_type: "lesson_viewed", lesson_id: "R01" });

  const { data: users } = await supabase.from("learning_users").select("id, shopify_customer_id, created_at, last_seen_at");
  const learners = computeLearnerTable(LEARNING_CATALOGUE, users, [], []);
  const resolved = await resolveShopifyIdentities(
    learners.map((l) => l.shopify_customer_id),
    { getConfig: () => CONFIGURED, fetchImpl: fakeShopifyFetch("token", { 111: { displayName: "James Lee", email: "james@example.com" } }) }
  );
  const enriched = learners.map((learner) => ({ ...learner, ...buildLearnerIdentity(learner.shopify_customer_id, resolved, CONFIGURED.shopDomain) }));

  assert.equal(enriched.length, 1, "only the one real learning_users row is ever enriched -- anonymous events add no rows");
  assert.equal(enriched[0].shopify_customer_id, "111");
  enriched.forEach((learner) => assert.ok(!("anonymous_visitor_id" in learner)));
});

test("security: the minted Shopify Admin access token never appears anywhere in the resolved identity data returned to a route", async () => {
  const mintedToken = "shpat_super_secret_admin_token_value";
  const resolved = await resolveShopifyIdentities(["111"], {
    getConfig: () => CONFIGURED,
    fetchImpl: fakeShopifyFetch(mintedToken, { 111: { displayName: "James Lee", email: "james@example.com" } })
  });
  const identity = buildLearnerIdentity("111", resolved, CONFIGURED.shopDomain);

  const serialized = JSON.stringify({ resolved: Array.from(resolved.entries()), identity });
  assert.ok(!serialized.includes(mintedToken), "the access token must never be embedded in resolved customer data");
  assert.deepEqual(Object.keys(identity).sort(), ["display_name", "email", "fallback_label", "shopify_admin_url"]);
});
