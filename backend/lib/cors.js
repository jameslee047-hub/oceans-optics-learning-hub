// Shared CORS handling for the endpoints called DIRECTLY by storefront JS
// (everything except api/proxy/*, which Shopify calls server-to-server and
// needs no CORS headers at all). Locked to the storefront origin -- never
// use `*` here, since these endpoints accept a bearer session token.
const ALLOWED_ORIGIN = process.env.STOREFRONT_ORIGIN || "https://oceansoptics.com";

export function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
