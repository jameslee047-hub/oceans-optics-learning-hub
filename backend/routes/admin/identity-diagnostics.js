// GET /api/admin/identity-diagnostics[?customerId=<numeric id>] -- admin-only,
// read-only health check for Shopify Admin customer identity resolution.
// Behind the same requireAdmin Basic Auth boundary as every other admin
// route, dispatched through the existing consolidated catch-all (no new
// Vercel function -- see api/admin/[...path].js). Never returns a token,
// secret, or any customer PII; `customerId` (if supplied) is used only to
// attempt one sample lookup and is echoed back nowhere in the response.
import { requireAdmin } from "../../lib/require-admin.js";
import { diagnoseShopifyIdentity } from "../../lib/shopify-identity-diagnostics.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const sampleCustomerId = typeof req.query?.customerId === "string" && req.query.customerId.length > 0 ? req.query.customerId : undefined;

  try {
    const diagnostics = await diagnoseShopifyIdentity({ sampleCustomerId });
    res.status(200).json(diagnostics);
  } catch (error) {
    console.error("GET /api/admin/identity-diagnostics failed", error.message);
    res.status(500).json({ error: "admin_identity_diagnostics_failed" });
  }
}
