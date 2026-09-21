import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeReturnPath, buildReturnUrl, DEFAULT_RETURN_PATH, STOREFRONT_ORIGIN } from "../lib/return-path.js";

test("accepts a normal Learning Hub relative path", () => {
  assert.equal(sanitizeReturnPath("/pages/learn"), "/pages/learn");
});

test("accepts a lesson relative path", () => {
  assert.equal(sanitizeReturnPath("/pages/learn/r05-choosing-a-mask"), "/pages/learn/r05-choosing-a-mask");
});

test("preserves a safe query string", () => {
  assert.equal(sanitizeReturnPath("/pages/learn-category/gear?tab=masks"), "/pages/learn-category/gear?tab=masks");
});

test("defaults when return_to is missing", () => {
  assert.equal(sanitizeReturnPath(undefined), DEFAULT_RETURN_PATH);
  assert.equal(sanitizeReturnPath(null), DEFAULT_RETURN_PATH);
  assert.equal(sanitizeReturnPath(""), DEFAULT_RETURN_PATH);
});

test("defaults for a non-string return_to", () => {
  assert.equal(sanitizeReturnPath(123), DEFAULT_RETURN_PATH);
  assert.equal(sanitizeReturnPath({}), DEFAULT_RETURN_PATH);
  assert.equal(sanitizeReturnPath(["/pages/learn"]), DEFAULT_RETURN_PATH);
});

test("rejects an absolute external URL", () => {
  assert.equal(sanitizeReturnPath("https://evil.example"), DEFAULT_RETURN_PATH);
  assert.equal(sanitizeReturnPath("https://evil.example/pages/learn"), DEFAULT_RETURN_PATH);
  assert.equal(sanitizeReturnPath("http://evil.example"), DEFAULT_RETURN_PATH);
});

test("rejects a protocol-relative URL", () => {
  assert.equal(sanitizeReturnPath("//evil.example"), DEFAULT_RETURN_PATH);
  assert.equal(sanitizeReturnPath("//evil.example/pages/learn"), DEFAULT_RETURN_PATH);
});

test("rejects a javascript: URI", () => {
  assert.equal(sanitizeReturnPath("javascript:alert(1)"), DEFAULT_RETURN_PATH);
});

test("rejects backslash variants that browsers normalize into a host separator", () => {
  assert.equal(sanitizeReturnPath("/\\evil.example"), DEFAULT_RETURN_PATH);
  assert.equal(sanitizeReturnPath("\\\\evil.example"), DEFAULT_RETURN_PATH);
  assert.equal(sanitizeReturnPath("/\\/evil.example"), DEFAULT_RETURN_PATH);
});

test("rejects encoded/whitespace open-redirect tricks that resolve to a different origin", () => {
  // Tab/newline characters are stripped by URL parsing before host
  // detection, which can turn something like this into "//evil.example".
  assert.equal(sanitizeReturnPath("/\t/evil.example"), DEFAULT_RETURN_PATH);
  assert.equal(sanitizeReturnPath("/\n/evil.example"), DEFAULT_RETURN_PATH);
});

test("rejects a bare host with no leading slash", () => {
  assert.equal(sanitizeReturnPath("evil.example"), DEFAULT_RETURN_PATH);
  assert.equal(sanitizeReturnPath("evil.example/pages/learn"), DEFAULT_RETURN_PATH);
});

test("drops any fragment the caller supplied (the callback appends its own)", () => {
  assert.equal(sanitizeReturnPath("/pages/learn#some-anchor"), "/pages/learn");
});

test("buildReturnUrl always uses the fixed storefront origin, never a caller-supplied one", () => {
  assert.equal(buildReturnUrl("/pages/learn"), `${STOREFRONT_ORIGIN}/pages/learn`);
  assert.equal(buildReturnUrl(DEFAULT_RETURN_PATH), "https://oceansoptics.com/pages/learn");
});
