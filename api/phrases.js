// Vercel function for POST /api/phrases — opt-in key phrases + translations.
// Same logic as the local server; see lib/gemini.js.
import { handlePhrases } from "../lib/gemini.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const { status, body } = await handlePhrases(req.body);
  res.status(status).json(body);
}
