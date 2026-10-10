// Smoke test: run `npm run check-key` to confirm the key and SDK work.
// Prints nothing sensitive — never logs the key itself.
import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("✗ GEMINI_API_KEY is empty. Paste your key into .env.local and try again.");
  process.exit(1);
}
console.log(`✓ Key loaded (${key.length} chars, starts "${key.slice(0, 4)}…")`);

const ai = new GoogleGenAI({});
try {
  const r = await ai.interactions.create({
    model: "gemini-3.8-flash",
    input: "Reply with exactly the word: ok"
  });
  console.log("✓ API responded:", (r.output_text || "").trim());
} catch (e) {
  console.error("✗ API call failed:", e.message);
  console.error("  If this mentions a model name, list available models in AI Studio and update the model id.");
  process.exit(1);
}
