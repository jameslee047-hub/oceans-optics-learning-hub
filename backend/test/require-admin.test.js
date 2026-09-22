import { test } from "node:test";
import assert from "node:assert/strict";
import { requireAdmin } from "../lib/require-admin.js";
import { createMockNodeResponse, withEnv } from "./cookie-test-utils.js";

const ADMIN_USERNAME = "staff";
const ADMIN_PASSWORD = "correct-horse-battery-staple";

function withAdminEnv(fn) {
  return withEnv({ ADMIN_DASHBOARD_USERNAME: ADMIN_USERNAME, ADMIN_DASHBOARD_PASSWORD: ADMIN_PASSWORD }, fn);
}

function basicAuthHeader(username, password) {
  return "Basic " + Buffer.from(`${username}:${password}`, "utf8").toString("base64");
}

test("rejects a request with no Authorization header at all", async () => {
  await withAdminEnv(async () => {
    const req = { headers: {} };
    const res = createMockNodeResponse();
    const allowed = requireAdmin(req, res);
    assert.equal(allowed, false);
    assert.equal(res.statusCode, 401);
    assert.ok(res.getHeader("WWW-Authenticate"), "must prompt the browser's native Basic Auth dialog");
  });
});

test("rejects a non-Basic Authorization header (e.g. a customer Bearer JWT)", async () => {
  await withAdminEnv(async () => {
    const req = { headers: { authorization: "Bearer some.customer.jwt" } };
    const res = createMockNodeResponse();
    assert.equal(requireAdmin(req, res), false);
    assert.equal(res.statusCode, 401);
  });
});

test("rejects the wrong password", async () => {
  await withAdminEnv(async () => {
    const req = { headers: { authorization: basicAuthHeader(ADMIN_USERNAME, "wrong-password") } };
    const res = createMockNodeResponse();
    assert.equal(requireAdmin(req, res), false);
    assert.equal(res.statusCode, 401);
  });
});

test("rejects the wrong username", async () => {
  await withAdminEnv(async () => {
    const req = { headers: { authorization: basicAuthHeader("someone-else", ADMIN_PASSWORD) } };
    const res = createMockNodeResponse();
    assert.equal(requireAdmin(req, res), false);
    assert.equal(res.statusCode, 401);
  });
});

test("rejects malformed base64 in the Authorization header without throwing", async () => {
  await withAdminEnv(async () => {
    const req = { headers: { authorization: "Basic not-valid-base64!!!" } };
    const res = createMockNodeResponse();
    assert.equal(requireAdmin(req, res), false);
    assert.equal(res.statusCode, 401);
  });
});

test("accepts the correct username and password", async () => {
  await withAdminEnv(async () => {
    const req = { headers: { authorization: basicAuthHeader(ADMIN_USERNAME, ADMIN_PASSWORD) } };
    const res = createMockNodeResponse();
    assert.equal(requireAdmin(req, res), true);
  });
});

test("fails closed (503) if ADMIN_DASHBOARD_USERNAME/PASSWORD are not configured, even with correct-looking credentials", () => {
  const previousUsername = process.env.ADMIN_DASHBOARD_USERNAME;
  const previousPassword = process.env.ADMIN_DASHBOARD_PASSWORD;
  delete process.env.ADMIN_DASHBOARD_USERNAME;
  delete process.env.ADMIN_DASHBOARD_PASSWORD;
  try {
    const req = { headers: { authorization: basicAuthHeader("anything", "anything") } };
    const res = createMockNodeResponse();
    assert.equal(requireAdmin(req, res), false);
    assert.equal(res.statusCode, 503);
  } finally {
    if (previousUsername !== undefined) process.env.ADMIN_DASHBOARD_USERNAME = previousUsername;
    if (previousPassword !== undefined) process.env.ADMIN_DASHBOARD_PASSWORD = previousPassword;
  }
});
