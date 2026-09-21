import { test } from "node:test";
import assert from "node:assert/strict";
import { requireSession } from "../lib/require-session.js";
import { mintSessionToken } from "../lib/session-token.js";

const SECRET = "test-session-secret";
const SHOP = "a44b34.myshopify.com";

function withEnv(vars, fn) {
  const previous = {};
  for (const key of Object.keys(vars)) previous[key] = process.env[key];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("returns the verified payload for a valid bearer token", () => {
  withEnv({ SESSION_TOKEN_SECRET: SECRET, SHOPIFY_SHOP_DOMAIN: SHOP }, () => {
    const token = mintSessionToken({ shopifyCustomerId: "customer-id-a", shop: SHOP, secret: SECRET });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    const payload = requireSession(req, res);
    assert.ok(payload);
    assert.equal(payload.shopify_customer_id, "customer-id-a");
    assert.equal(res.statusCode, null, "should not write a response on success");
  });
});

test("rejects a missing Authorization header", () => {
  withEnv({ SESSION_TOKEN_SECRET: SECRET, SHOPIFY_SHOP_DOMAIN: SHOP }, () => {
    const req = { headers: {} };
    const res = fakeRes();
    const payload = requireSession(req, res);
    assert.equal(payload, null);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "missing_bearer_token");
  });
});

test("a bearer token for one customer can never resolve to a different customer ID", () => {
  withEnv({ SESSION_TOKEN_SECRET: SECRET, SHOPIFY_SHOP_DOMAIN: SHOP }, () => {
    const token = mintSessionToken({ shopifyCustomerId: "customer-id-a", shop: SHOP, secret: SECRET });

    // A malicious client also claims to be "customer-id-b" via an unrelated
    // request field -- requireSession has no such field in its signature
    // and must not be influenced by anything except the token itself.
    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { shopify_customer_id: "customer-id-b", subject: "customer-id-b" },
      query: { shopify_customer_id: "customer-id-b" }
    };
    const res = fakeRes();
    const payload = requireSession(req, res);
    assert.equal(payload.shopify_customer_id, "customer-id-a", "must resolve strictly from the token, never the body/query");
  });
});

test("rejects a token signed with a different secret", () => {
  withEnv({ SESSION_TOKEN_SECRET: SECRET, SHOPIFY_SHOP_DOMAIN: SHOP }, () => {
    const token = mintSessionToken({ shopifyCustomerId: "customer-id-a", shop: SHOP, secret: "a-different-secret" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    const payload = requireSession(req, res);
    assert.equal(payload, null);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "invalid_signature");
  });
});
