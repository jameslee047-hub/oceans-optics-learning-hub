// Reads a Vercel API route's raw request body as a string. Required for
// webhook HMAC verification, which must run over the exact bytes Shopify
// sent -- re-serializing a parsed JSON body can reorder keys or change
// whitespace and silently break verification. Callers must disable the
// default body parser: `export const config = { api: { bodyParser: false } }`.
export function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
