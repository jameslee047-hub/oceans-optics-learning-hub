// Server-only Supabase client. The service-role key lives ONLY in Vercel's
// environment variables for this backend -- it must never be sent to, or
// readable by, the browser. Every query in this file is scoped explicitly
// by a shopify_customer_id derived from a verified session token (see
// lib/session-token.js), never from a request body/query value supplied
// directly by the client.
// @supabase/supabase-js is imported dynamically (only when a real client is
// actually requested) so that the rest of this file -- findOrCreateLearningUser,
// deleteLearningUserByShopifyCustomerId -- stays unit-testable against the
// fake in test/fake-supabase.js without requiring the real package to be
// installed just to run tests.
let cachedClient = null;

export async function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const { createClient } = await import("@supabase/supabase-js");
  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return cachedClient;
}

// Finds or creates the learning_users row for a verified Shopify customer.
// This is the ONLY place a shopify_customer_id is ever written -- every
// other table is keyed by the resulting internal `learning_users.id`.
//
// `shopifyCustomerId` is the numeric Shopify Admin customer ID, obtained
// from the Customer Account API's authenticated `customer { id }` query
// (see lib/shopify-customer-gid.js for the gid://shopify/Customer/{id}
// validation/extraction) -- never the OIDC `sub`, and never a value
// supplied directly by browser JS.
//
// Uses a single atomic UPSERT (ON CONFLICT (shopify_customer_id)), not a
// select-then-insert -- a customer opening several lesson pages at once
// fires several concurrent identity checks, and a check-then-insert has a
// race window where two concurrent calls can both see "no existing row" and
// both try to insert, relying on the UNIQUE constraint to reject one as an
// unhandled error. A single upsert has no such window.
export async function findOrCreateLearningUser(supabase, shopifyCustomerId) {
  const { data, error } = await supabase
    .from("learning_users")
    .upsert(
      { shopify_customer_id: shopifyCustomerId, last_seen_at: new Date().toISOString() },
      { onConflict: "shopify_customer_id" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

// Used by the customers/redact webhook. Deleting the learning_users row is
// the entire redaction -- lesson_progress and knowledge_check_results are
// removed by the ON DELETE CASCADE foreign keys defined in
// migrations/0001_init.sql, not by any application code here.
export async function deleteLearningUserByShopifyCustomerId(supabase, shopifyCustomerId) {
  const { error } = await supabase.from("learning_users").delete().eq("shopify_customer_id", shopifyCustomerId);
  if (error) throw error;
}
