// One Vercel function for the complete internal analytics dashboard.
import dashboardHandler from "../../routes/admin/index.js";
import summaryHandler from "../../routes/admin/summary.js";
import lessonsHandler from "../../routes/admin/lessons.js";
import questionsHandler from "../../routes/admin/questions.js";
import learnersHandler from "../../routes/admin/learners.js";
import learnerDetailHandler from "../../routes/admin/learners/[id].js";
import funnelHandler from "../../routes/admin/funnel.js";
import categoriesHandler from "../../routes/admin/categories.js";
import { requireAdmin } from "../../lib/require-admin.js";

export function pathSegments(pathValue) {
  if (Array.isArray(pathValue)) return pathValue.map(String).filter(Boolean);
  if (typeof pathValue === "string") return pathValue.split("/").filter(Boolean);
  return [];
}

// Every route this dispatcher knows about, by its first path segment --
// used only to recognize a req.url that has already had its /api/admin (or
// /admin) mount prefix stripped off before this function ever saw it (see
// the third branch in adminPathFromUrl below). Keep in sync with the
// dispatch table in handler() itself.
const KNOWN_TOP_LEVEL_SEGMENTS = new Set(["dashboard", "summary", "lessons", "questions", "learners", "funnel", "categories"]);

export function adminPathFromUrl(urlValue) {
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
  // Belt-and-braces: some Vercel routing paths (a nested catch-all segment
  // resolved via a rewrite, a runtime that hands this function a req.url
  // already relative to its own mount point) can produce a pathname with
  // NEITHER the /api nor /admin prefix still attached -- e.g. "/learners/
  // <id>" instead of "/api/admin/learners/<id>". Accept that shape too, but
  // only when its first segment is one of this router's own known routes,
  // so a genuinely unrelated path is never misread as an admin route.
  if (segments.length > 0 && KNOWN_TOP_LEVEL_SEGMENTS.has(segments[0])) return segments;
  return null;
}

// True for exactly the segment shapes handler() below actually dispatches
// (an empty path, one known top-level route, or a two-segment learners/:id
// path) -- used to pick between the two possible sources of the path (see
// requestedAdminPath) rather than trusting whichever happens to be non-null.
export function isRecognizedAdminPath(segments) {
  if (segments.length === 0) return true;
  if (segments.length === 1) return KNOWN_TOP_LEVEL_SEGMENTS.has(segments[0]);
  if (segments.length === 2) return segments[0] === "learners";
  return false;
}

export function requestedAdminPath(req) {
  // In Vercel's Node runtime req.query contains the URL query string; the
  // dynamic filesystem path is not guaranteed to be copied into query.path.
  // req.url also survives both the direct /api/admin route and /admin rewrite
  // shapes, so prefer it whenever it identifies a route this router
  // actually knows about. If it doesn't (a shape adminPathFromUrl couldn't
  // make sense of, or a genuinely unknown route), fall back to Vercel's own
  // query.path -- checked ONLY when Vercel actually set it, so a request
  // with no path info at all still correctly falls through to the exact
  // same "unknown route" or "root" behavior as before, rather than a
  // missing query.path being misread as an empty ("root") path.
  const fromUrl = adminPathFromUrl(req.url);
  if (fromUrl !== null && isRecognizedAdminPath(fromUrl)) return fromUrl;

  if (req.query?.path !== undefined) {
    const fromQuery = pathSegments(req.query.path);
    if (isRecognizedAdminPath(fromQuery)) return fromQuery;
  }

  return fromUrl ?? pathSegments(req.query?.path);
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
  if (segments.length === 1 && segments[0] === "funnel") return funnelHandler(req, res);
  if (segments.length === 1 && segments[0] === "categories") return categoriesHandler(req, res);
  if (segments.length === 2 && segments[0] === "learners") {
    const routedRequest = { ...req, query: { ...req.query, id: segments[1] } };
    return learnerDetailHandler(routedRequest, res);
  }

  // Keep even unknown paths under the private admin namespace behind the
  // same Basic Auth boundary as every known endpoint.
  if (!requireAdmin(req, res)) return;
  res.status(404).json({ error: "admin_route_not_found" });
}
