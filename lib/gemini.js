/* Gemini logic shared by the local server (server.js) and the Vercel
 * functions (api/match.js, api/phrases.js). This module is the ONLY place the
 * Gemini key is used; it runs on the server, never in the browser.
 *
 * The matcher NEVER returns generated target-language text. It picks one of
 * the answers you wrote, or says "none". Any explanation it returns is in
 * English, which the learner can judge for themselves.
 */
import { GoogleGenAI } from "@google/genai";

export const hasKey = !!process.env.GEMINI_API_KEY;
const ai = hasKey ? new GoogleGenAI({}) : null;

/* The free tier allows 5 requests a minute. Spending them and then failing is
   worse than not spending them, so refuse locally once 4 are gone in the last
   minute and let the caller fall back to the static comparison. */
const RPM_BUDGET = 4;

/* Answer-checker model. gemini-3.8-flash took over 90s per check, far past the
   app's 15s wait, so every check came back "Not checked". Override with
   GEMINI_MATCH_MODEL in .env.local. The server gives up just before the app
   does, so the learner gets an honest "took too long" instead of a hang. */
const MATCH_MODEL = process.env.GEMINI_MATCH_MODEL || "gemini-3.5-flash-lite";
const MATCH_TIMEOUT_MS = 13_000;
const withTimeout = (p, ms) => Promise.race([p,
  new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
let calls = [];
function overBudget(){
  const cutoff = Date.now() - 60_000;
  calls = calls.filter(t => t > cutoff);
  if (calls.length >= RPM_BUDGET) return Math.ceil((calls[0] + 60_000 - Date.now()) / 1000);
  calls.push(Date.now());
  return 0;
}

/* Ask the model which of OUR answers the learner's utterance matches.
   It returns an index or null — never a sentence to show the learner. */
async function match({ scene, accepted, utterance, vocab = [] }) {
  const prompt = `You are coaching a language learner in a real conversation.
You must NOT write any target-language sentence of your own.

JUDGE THE CONVERSATION, NOT THE SCRIPT. The learner is not trying to reproduce a
sentence. They are trying to hold up their end of a conversation. The reference
line below is ONE way a native speaker did it — it is not an answer key, and an
answer that shares no words with it can be completely successful.

SITUATION: ${scene}
ONE WAY A NATIVE SPEAKER DID IT (reference only, NOT the required answer):
${accepted.map((a, i) => `${i}. ${a}`).join("\n")}

PHRASES THE LEARNER HAS MET IN TODAY'S CONVERSATION:
${vocab.length ? vocab.map(v => `- ${v}`).join("\n") : "(none supplied)"}

THE LEARNER SAID: "${utterance}"

Reply with JSON only, no markdown fence:
{"verdict":"works"|"thin"|"missed",
 "index":<number or null>,
 "note":"<1-2 sentences of ENGLISH feedback>",
 "suggest":[<zero to two phrases COPIED EXACTLY from the list above, no others>],
 "structure":"<one ENGLISH sentence naming something concrete they could add, or empty>"}

Judge ONLY these two questions:
  (a) Does it answer what was actually asked?
  (b) Does it give the other person something to react to or ask about?

- "works": both yes. It keeps the conversation alive. It does NOT need to resemble
  the reference line. If it is close in meaning to the reference, set index.
- "thin": correct and appropriate, but it hands the other person nothing — a dead end
  that would make them work to continue. This is the most common and most useful verdict.
- "missed": it does not answer what was asked, or the register is wrong for a colleague.

- The note must be SPECIFIC. Never "good try". Say what worked, then what was missing.
  Never tell them their answer was wrong because it differed from the reference.
- "suggest" may only contain phrases copied verbatim from the list above. If none fit,
  return an empty array. Never invent a phrase.
- "structure" names one concrete move in English — "say how long it took", "give a
  reason", "ask the question back". One idea only.
- Never grade, never score, never say "incorrect", never compare to the reference in
  the note unless the learner's answer was genuinely unclear.`;

  const r = await withTimeout(ai.interactions.create({ model: MATCH_MODEL, input: prompt }), MATCH_TIMEOUT_MS);
  const raw = (r.output_text || "").trim().replace(/^```(?:json)?|```$/g, "").trim();
  const out = JSON.parse(raw);
  // Never trust the model with an out-of-range index.
  if (typeof out.index !== "number" || out.index < 0 || out.index >= accepted.length) out.index = null;
  if (!["works","thin","missed"].includes(out.verdict)) out.verdict = "thin";
  // Suggestions must come from OUR vocabulary. Anything invented is discarded.
  out.suggest = Array.isArray(out.suggest) ? out.suggest.filter(x => vocab.includes(x)).slice(0, 2) : [];
  if (typeof out.structure !== "string") out.structure = "";
  return out;
}

/* Opt-in phrase picker (Requirement 12.6). Only called when the learner ticks
   the Gemini box. The model may only CHOOSE phrases from the learner's text;
   anything not found verbatim in a line is discarded here, and the client
   checks again before building cards. It also returns an English translation
   per line, which the app labels as a Gemini machine translation. No French
   is ever generated. */
const MAX_PHRASES = 12;
// A "lite" model: this is a simple pick-and-translate job, and the full model
// took up to a minute. Override with GEMINI_PHRASE_MODEL in .env.local.
const PHRASE_MODEL = process.env.GEMINI_PHRASE_MODEL || "gemini-3.5-flash-lite";
// Never leave the learner waiting forever: give up and use the built-in picker.
const PHRASE_TIMEOUT_MS = 45_000;
async function pickPhrases(lines) {
  const prompt = `A language learner pasted this French text to practise speaking.
Pick the ${MAX_PHRASES} or fewer phrases most worth learning for real conversation:
reusable expressions and collocations (e.g. "beaucoup de monde", "bien sûr",
"ça te dit"), not names of people or places, not lone grammar words.

RULES:
- Copy each phrase EXACTLY as it appears in the text: same spelling, accents,
  capitals and apostrophes. Never change, translate, or invent words.
- Each phrase is 1 to 5 consecutive words from a single line, without
  surrounding punctuation.
- Spread the picks across the whole text.

ALSO translate every numbered line into natural, everyday English, one
translation per line, in the same order (exactly ${lines.length} translations).

TEXT (one line per entry):
${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}

Reply with JSON only, no markdown fence:
{"phrases":["...","..."],"translations":["<English for line 1>","<English for line 2>", ...]}`;

  const r = await withTimeout(ai.interactions.create({ model: PHRASE_MODEL, input: prompt }), PHRASE_TIMEOUT_MS);
  const raw = (r.output_text || "").trim().replace(/^```(?:json)?|```$/g, "").trim();
  const out = JSON.parse(raw);
  const seen = new Set();
  const phrases = (Array.isArray(out.phrases) ? out.phrases : [])
    .filter(p => typeof p === "string")
    .map(p => p.trim())
    .filter(p => p && p.length <= 80 && !seen.has(p) && seen.add(p) && lines.some(l => l.includes(p)))
    .slice(0, MAX_PHRASES);
  // English only, one per line. A count mismatch means we can't tell which
  // translation belongs to which line, so none are used rather than misaligned.
  const tr = Array.isArray(out.translations) ? out.translations : [];
  const translations = tr.length === lines.length
    ? tr.map(t => (typeof t === "string" ? t.trim().slice(0, 400) : ""))
    : [];
  return { phrases, translations };
}

/* Request handlers. Each takes the parsed JSON body and returns
   { status, body } so any HTTP layer (node:http or Vercel) can send it. */
export async function handleMatch(body) {
  if (!hasKey) return { status: 503, body: { error: "no_key", hint: "Set GEMINI_API_KEY, then restart." } };
  try {
    if (!body || !body.utterance || !Array.isArray(body.accepted)) return { status: 400, body: { error: "bad_request" } };
    const wait = overBudget();
    if (wait) return { status: 200, body: { verdict: "unchecked", index: null,
      note: `Couldn't check this one — free tier allows 5 checks a minute (about ${wait}s left). Compare it yourself below.` } };
    const t0 = Date.now();
    const out = await match(body);
    console.log(`  /api/match: ${out.verdict}, ${Date.now() - t0}ms`);
    return { status: 200, body: out };
  } catch (e) {
    console.log(`  /api/match failed: ${e.message}`);
    /* NEVER return "missed" on a failure. A quota error is not evidence that
       the learner was wrong, and saying so would be the one dishonest thing
       this product cannot afford. "unchecked" means exactly that. */
    const rate = /429|quota|rate/i.test(e.message || "");
    return { status: 200, body: { verdict: "unchecked", index: null,
      note: rate ? "Couldn't check this one — the free tier allows 5 checks a minute. Compare it yourself below."
          : e.message === "timeout" ? "Couldn't check this one — Gemini took too long. Compare it yourself below."
          : "Couldn't check this one right now. Compare it yourself below.",
      error: e.message } };
  }
}

export async function handlePhrases(body) {
  // Never an error status for the learner: any failure means "use the
  // built-in picker", reported in plain English.
  if (!hasKey) return { status: 200, body: { phrases: [], note: "Gemini isn't set up on this server." } };
  try {
    const lines = body && Array.isArray(body.lines) ? body.lines.filter(l => typeof l === "string").slice(0, 200) : [];
    if (!lines.length) return { status: 400, body: { error: "bad_request" } };
    const wait = overBudget();
    if (wait) { console.log(`  /api/phrases: refused locally, rate budget (${wait}s)`);
      return { status: 200, body: { phrases: [], note: `Gemini's free tier is busy (about ${wait}s left).` } }; }
    const t0 = Date.now();
    const out = await pickPhrases(lines);
    // Counts only — never the learner's text.
    console.log(`  /api/phrases: ${lines.length} lines → ${out.phrases.length} phrases, ` +
      `${out.translations.length} translations, ${Date.now() - t0}ms`);
    return { status: 200, body: out };
  } catch (e) {
    console.log(`  /api/phrases failed: ${e.message}`);
    const rate = /429|quota|rate/i.test(e.message || "");
    return { status: 200, body: { phrases: [], error: e.message,
      note: rate ? "Gemini's free tier limit was reached."
          : e.message === "timeout" ? "Gemini took too long to answer."
          : "Gemini couldn't be reached." } };
  }
}
