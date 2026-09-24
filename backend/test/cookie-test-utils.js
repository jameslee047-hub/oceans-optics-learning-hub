// Shared test helper: parses a single Set-Cookie header string into
// { name, attributes }. Deliberately never returns the cookie's value to
// callers -- tests must assert on attributes (HttpOnly, Path, etc.), never
// log or assert the literal signed value.
export function parseSetCookieAttributes(setCookieHeader) {
  const [nameValue, ...attrParts] = setCookieHeader.split(";").map((part) => part.trim());
  const name = nameValue.slice(0, nameValue.indexOf("="));
  const attributes = {};
  for (const attr of attrParts) {
    const separatorIndex = attr.indexOf("=");
    if (separatorIndex === -1) {
      attributes[attr.toLowerCase()] = true;
    } else {
      attributes[attr.slice(0, separatorIndex).toLowerCase()] = attr.slice(separatorIndex + 1);
    }
  }
  return { name, attributes };
}

// Mimics both the plain Node http.ServerResponse methods this backend's
// route handlers use (setHeader/statusCode/end) AND the Vercel convenience
// methods (status().json()) -- real handlers in this codebase use both
// styles in the same file.
export function createMockNodeResponse() {
  const headers = {};
  const res = {
    statusCode: 200,
    ended: false,
    jsonBody: undefined,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    end() {
      this.ended = true;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.jsonBody = body;
      return this;
    }
  };
  return res;
}

// Temporarily sets process.env vars for the duration of an async callback,
// restoring the previous values (or deleting the key if it was previously
// unset) afterward. MUST await `fn()` inside the try -- returning the bare
// promise from `fn()` without awaiting it here would let `finally` restore
// the environment before an async handler actually finishes reading it,
// which is exactly the bug this comment exists to prevent from recurring.
export async function withEnv(vars, fn) {
  const previous = {};
  for (const key of Object.keys(vars)) previous[key] = process.env[key];
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

// Temporarily replaces console.error to capture every call made during
// `fn()`, restoring the original afterward (even if `fn` throws). Returns
// { result, logs } where `logs` is every call's arguments joined into one
// string per call -- tests assert a secret/PII value never appears
// anywhere in it, and/or that an expected safe message/field does.
export async function withCapturedConsoleError(fn) {
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args.map((arg) => String(arg)).join(" "));
  try {
    const result = await fn();
    return { result, logs };
  } finally {
    console.error = originalConsoleError;
  }
}
