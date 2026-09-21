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
