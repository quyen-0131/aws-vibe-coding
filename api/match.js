// Vercel function for POST /api/match — the Say it answer checker.
// Same logic as the local server; see lib/gemini.js.
import { handleMatch } from "../lib/gemini.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const { status, body } = await handleMatch(req.body);
  res.status(status).json(body);
}
