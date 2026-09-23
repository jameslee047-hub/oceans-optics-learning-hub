import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = path.join(BACKEND_DIR, "api");

function findJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findJavaScriptFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith(".js") ? [absolutePath] : [];
  });
}

test("Vercel function inventory stays at or below the Hobby-plan limit", () => {
  const functions = findJavaScriptFiles(API_DIR)
    .map((file) => path.relative(API_DIR, file).split(path.sep).join("/"))
    .sort();

  assert.deepEqual(functions, [
    "admin/[...path].js",
    "customer-auth/callback.js",
    "customer-auth/exchange.js",
    "customer-auth/start.js",
    "learning-event.js",
    "lesson/[action].js",
    "progress.js",
    "proxy/identity.js",
    "quiz/result.js",
    "webhooks/customers-data-request.js",
    "webhooks/customers-redact.js",
    "webhooks/shop-redact.js"
  ]);
  assert.equal(functions.length, 12);
});

test("Vercel rewrites keep /admin and /api/admin routed to the consolidated dashboard function", () => {
  const config = JSON.parse(fs.readFileSync(path.join(BACKEND_DIR, "vercel.json"), "utf8"));
  assert.deepEqual(config.rewrites, [
    { source: "/api/admin", destination: "/api/admin/dashboard" },
    { source: "/admin", destination: "/api/admin/dashboard" },
    { source: "/admin/:path*", destination: "/api/admin/:path*" }
  ]);
});
