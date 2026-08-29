import fs from "node:fs";
import path from "node:path";
import { SHOPIFY_ROOT } from "./lib/learning-data.js";

const REQUIRED_API_VERSION = "2026-07";
const TOKEN_REFRESH_MARGIN_MS = 60_000;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function normalizeStoreDomain(value) {
  if (!value) return "";
  const host = value
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
  if (!host) return "";
  return host.includes(".") ? host : `${host}.myshopify.com`;
}

function stripGraphqlComments(document) {
  return String(document)
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, ""))
    .join("\n");
}

export function rejectMutation(document) {
  const stripped = stripGraphqlComments(document);
  if (/\bmutation\b/i.test(stripped)) {
    throw new Error("Preflight mode rejected a GraphQL mutation operation.");
  }
}

export function loadShopifyConfig() {
  const envFile = parseEnvFile(path.join(SHOPIFY_ROOT, ".env"));
  const storeDomain = normalizeStoreDomain(process.env.SHOPIFY_STORE_DOMAIN || envFile.SHOPIFY_STORE_DOMAIN);
  const clientId = process.env.SHOPIFY_CLIENT_ID || envFile.SHOPIFY_CLIENT_ID || "";
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || envFile.SHOPIFY_CLIENT_SECRET || "";
  const legacyAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || envFile.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
  const apiVersion = process.env.SHOPIFY_API_VERSION || envFile.SHOPIFY_API_VERSION || REQUIRED_API_VERSION;
  const missing = [];
  const authMode = clientId && clientSecret
    ? "client_credentials"
    : legacyAccessToken
      ? "legacy_admin_access_token"
      : "missing";

  if (!storeDomain) missing.push("SHOPIFY_STORE_DOMAIN");
  if (authMode === "missing") missing.push("SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET or SHOPIFY_ADMIN_ACCESS_TOKEN");
  if (!apiVersion) missing.push("SHOPIFY_API_VERSION");

  return {
    storeDomain,
    clientId,
    clientSecret,
    legacyAccessToken,
    authMode,
    apiVersion,
    requiredApiVersion: REQUIRED_API_VERSION,
    missing,
    configured: missing.length === 0,
    apiVersionMatchesRequirement: apiVersion === REQUIRED_API_VERSION
  };
}

export function createShopifyTokenManager(config) {
  const tokenEndpoint = `https://${config.storeDomain}/admin/oauth/access_token`;
  let clientCredentialsToken = null;
  let clientCredentialsTokenExpiresAt = 0;
  let lastAuth = {
    mode: config.authMode,
    succeeded: false,
    tokenExpiresAt: null
  };

  return {
    async getAccessToken() {
    if (config.authMode === "legacy_admin_access_token") {
      lastAuth = {
        mode: config.authMode,
        succeeded: Boolean(config.legacyAccessToken),
        tokenExpiresAt: null
      };
      return config.legacyAccessToken;
    }

    if (config.authMode !== "client_credentials") {
      throw new Error("Shopify authentication is not configured.");
    }

    if (clientCredentialsToken && Date.now() < clientCredentialsTokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
      lastAuth = {
        mode: config.authMode,
        succeeded: true,
        tokenExpiresAt: new Date(clientCredentialsTokenExpiresAt).toISOString()
      };
      return clientCredentialsToken;
    }

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret
      })
    });
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Shopify client credentials token request failed with status ${response.status}; response was not valid JSON.`);
    }

    if (!response.ok || !body.access_token) {
      throw new Error(`Shopify client credentials token request failed with status ${response.status}. Check store domain, app installation, client credentials, and selected access scopes.`);
    }

    clientCredentialsToken = body.access_token;
    clientCredentialsTokenExpiresAt = Date.now() + Number(body.expires_in ?? 86_399) * 1000;
    lastAuth = {
      mode: config.authMode,
      succeeded: true,
      tokenExpiresAt: new Date(clientCredentialsTokenExpiresAt).toISOString()
    };
    return clientCredentialsToken;
    },
    getAuthStatus() {
      return {
        mode: lastAuth.mode,
        succeeded: lastAuth.succeeded,
        tokenExpiresAt: lastAuth.tokenExpiresAt
      };
    }
  };
}

export function createShopifyAdminClient(config) {
  const endpoint = `https://${config.storeDomain}/admin/api/${config.apiVersion}/graphql.json`;
  const restBaseUrl = `https://${config.storeDomain}/admin/api/${config.apiVersion}`;
  const tokenManager = createShopifyTokenManager(config);

  async function graphqlReadOnly(query, variables = {}, operationName = undefined) {
    rejectMutation(query);
    const accessToken = await tokenManager.getAccessToken();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query, variables, operationName })
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { parseError: "Response was not valid JSON." };
    }
    return {
      ok: response.ok && !body.errors,
      status: response.status,
      actualApiVersion: response.headers.get("x-shopify-api-version"),
      body
    };
  }

  async function restGet(readOnlyPath) {
    if (!readOnlyPath.startsWith("/")) {
      throw new Error("REST path must start with /.");
    }
    const accessToken = await tokenManager.getAccessToken();
    const response = await fetch(`${restBaseUrl}${readOnlyPath}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      }
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { parseError: "Response was not valid JSON." };
    }
    return {
      ok: response.ok,
      status: response.status,
      actualApiVersion: response.headers.get("x-shopify-api-version"),
      body
    };
  }

  return {
    graphqlReadOnly,
    restGet,
    getAuthStatus: () => tokenManager.getAuthStatus()
  };
}

function redactSensitiveText(value) {
  return String(value ?? "Unknown error")
    .replace(/(access_token["'=:\s]+)[^"',\s}]+/gi, "$1[REDACTED]")
    .replace(/(client_secret["'=:\s]+)[^"',\s}]+/gi, "$1[REDACTED]")
    .replace(/(SHOPIFY_CLIENT_SECRET["'=:\s]+)[^"',\s}]+/gi, "$1[REDACTED]")
    .replace(/(SHOPIFY_ADMIN_ACCESS_TOKEN["'=:\s]+)[^"',\s}]+/gi, "$1[REDACTED]")
    .replace(/shpat_[A-Za-z0-9_]+/g, "[REDACTED]")
    .replace(/[A-Fa-f0-9]{32,}/g, "[REDACTED]");
}

export function sanitizeError(error) {
  return {
    message: redactSensitiveText(error?.message)
  };
}
