// One Vercel function for the two Learning Progress lesson mutations.
// Public URLs remain /api/lesson/viewed and /api/lesson/complete.
import completeHandler from "../../routes/lesson/complete.js";
import viewedHandler from "../../routes/lesson/viewed.js";
import { applyCors } from "../../lib/cors.js";

export default async function handler(req, res) {
  const actionValue = req.query?.action;
  const action = Array.isArray(actionValue) ? actionValue[0] : actionValue;

  if (action === "complete") return completeHandler(req, res);
  if (action === "viewed") return viewedHandler(req, res);

  if (applyCors(req, res)) return;
  res.status(404).json({ error: "lesson_route_not_found" });
}
