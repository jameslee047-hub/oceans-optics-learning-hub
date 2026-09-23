// One Vercel function for the complete internal analytics dashboard.
import dashboardHandler from "../../routes/admin/index.js";
import summaryHandler from "../../routes/admin/summary.js";
import lessonsHandler from "../../routes/admin/lessons.js";
import questionsHandler from "../../routes/admin/questions.js";
import learnersHandler from "../../routes/admin/learners.js";
import learnerDetailHandler from "../../routes/admin/learners/[id].js";
import { requireAdmin } from "../../lib/require-admin.js";

function pathSegments(pathValue) {
  if (Array.isArray(pathValue)) return pathValue.map(String).filter(Boolean);
  if (typeof pathValue === "string") return pathValue.split("/").filter(Boolean);
  return [];
}

function adminPathFromUrl(urlValue) {
  if (typeof urlValue !== "string" || urlValue.length === 0) return null;

  let pathname;
  try {
    pathname = new URL(urlValue, "http://vercel.local").pathname;
  } catch {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "api" && segments[1] === "admin") return segments.slice(2);
  if (segments[0] === "admin") return segments.slice(1);
  return null;
}

function requestedAdminPath(req) {
  // In Vercel's Node runtime req.query contains the URL query string; the
  // dynamic filesystem path is not guaranteed to be copied into query.path.
  // req.url also survives both the direct /api/admin route and /admin rewrite
  // shapes, so prefer it whenever it identifies the admin namespace.
  return adminPathFromUrl(req.url) ?? pathSegments(req.query?.path);
}

export default async function handler(req, res) {
  const segments = requestedAdminPath(req);

  if (segments.length === 0 || (segments.length === 1 && segments[0] === "dashboard")) {
    return dashboardHandler(req, res);
  }
  if (segments.length === 1 && segments[0] === "summary") return summaryHandler(req, res);
  if (segments.length === 1 && segments[0] === "lessons") return lessonsHandler(req, res);
  if (segments.length === 1 && segments[0] === "questions") return questionsHandler(req, res);
  if (segments.length === 1 && segments[0] === "learners") return learnersHandler(req, res);
  if (segments.length === 2 && segments[0] === "learners") {
    const routedRequest = { ...req, query: { ...req.query, id: segments[1] } };
    return learnerDetailHandler(routedRequest, res);
  }

  // Keep even unknown paths under the private admin namespace behind the
  // same Basic Auth boundary as every known endpoint.
  if (!requireAdmin(req, res)) return;
  res.status(404).json({ error: "admin_route_not_found" });
}
