// One Vercel function for the complete internal analytics dashboard.
// Vercel supplies the catch-all `path` parameter as an array; accepting a
// slash-delimited string as well keeps local/unit invocation predictable.
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

export default async function handler(req, res) {
  const segments = pathSegments(req.query?.path);

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
