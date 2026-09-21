import { test } from "node:test";
import assert from "node:assert/strict";
import { extractNumericCustomerId } from "../lib/shopify-customer-gid.js";

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
