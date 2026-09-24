import { test } from "node:test";
import assert from "node:assert/strict";
import { extractNumericCustomerId, buildCustomerGid } from "../lib/shopify-customer-gid.js";

test("extracts the numeric suffix from a valid Customer GID", () => {
  assert.equal(extractNumericCustomerId("gid://shopify/Customer/555000111"), "555000111");
});

test("extracts correctly even for a very large numeric ID (no precision loss as a string)", () => {
  assert.equal(extractNumericCustomerId("gid://shopify/Customer/9007199254740993"), "9007199254740993");
});

test("rejects a malformed GID (non-numeric suffix)", () => {
  assert.throws(() => extractNumericCustomerId("gid://shopify/Customer/abc123"), /invalid_customer_gid/);
});

test("rejects a GID for a different resource type", () => {
  assert.throws(() => extractNumericCustomerId("gid://shopify/Order/555000111"), /invalid_customer_gid/);
});

test("rejects a GID with extra path segments", () => {
  assert.throws(() => extractNumericCustomerId("gid://shopify/Customer/555000111/extra"), /invalid_customer_gid/);
});

test("rejects an empty numeric suffix", () => {
  assert.throws(() => extractNumericCustomerId("gid://shopify/Customer/"), /invalid_customer_gid/);
});

test("rejects a completely unrelated string", () => {
  assert.throws(() => extractNumericCustomerId("not-a-gid-at-all"), /invalid_customer_gid/);
});

test("rejects null/undefined/non-string input", () => {
  assert.throws(() => extractNumericCustomerId(null), /invalid_customer_gid/);
  assert.throws(() => extractNumericCustomerId(undefined), /invalid_customer_gid/);
  assert.throws(() => extractNumericCustomerId(555000111), /invalid_customer_gid/);
});

test("rejects an empty string", () => {
  assert.throws(() => extractNumericCustomerId(""), /invalid_customer_gid/);
});

// ---------------- buildCustomerGid ----------------

test("buildCustomerGid: converts the exact numeric id from the live incident into the expected Admin GraphQL Customer GID", () => {
  assert.equal(buildCustomerGid("7662557626701"), "gid://shopify/Customer/7662557626701");
});

test("buildCustomerGid: round-trips through extractNumericCustomerId for a variety of ids", () => {
  for (const id of ["1", "555000111", "9007199254740993", "7662557626701"]) {
    assert.equal(extractNumericCustomerId(buildCustomerGid(id)), id);
  }
});

test("buildCustomerGid: accepts a JS number and converts it to the equivalent string-based GID", () => {
  assert.equal(buildCustomerGid(7662557626701), "gid://shopify/Customer/7662557626701");
});

test("buildCustomerGid: rejects a non-numeric string", () => {
  assert.throws(() => buildCustomerGid("abc123"), /invalid_numeric_customer_id/);
});

test("buildCustomerGid: rejects an empty string, null, and undefined", () => {
  assert.throws(() => buildCustomerGid(""), /invalid_numeric_customer_id/);
  assert.throws(() => buildCustomerGid(null), /invalid_numeric_customer_id/);
  assert.throws(() => buildCustomerGid(undefined), /invalid_numeric_customer_id/);
});

test("buildCustomerGid: rejects a value that is already a GID (would double-wrap it)", () => {
  assert.throws(() => buildCustomerGid("gid://shopify/Customer/555000111"), /invalid_numeric_customer_id/);
});
