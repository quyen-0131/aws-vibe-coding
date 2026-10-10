// matcher-adapter.js — Say-it matcher adapter (reuses the existing /api/match).
//
// Sends only { scene, accepted:[referenceSourceLine], utterance, vocab } to the
// existing matcher endpoint, maps the response verdict into the fixed set,
// discards any model-generated French, and reveals the learner's own reference
// Source_Line. On any unavailability it returns `not checked` so the learner can
// self-judge.
//
// The guiding constraints (Requirement 8, design Property 13):
//   - 8.1 send the attempt, the learner's own reference Source_Line, and the
//     Scene framing to the existing matcher endpoint;
//   - 8.2 present exactly one Verdict from {works, thin, missed, not checked}
//     with English coach notes;
//   - 8.3 reveal the learner's own Source_Line, labelled as a reference;
//   - 8.4 discard any French the matcher generated — present only the verdict,
//     the English note, and the learner's own Source_Line;
//   - 8.5 coerce any verdict value outside the known set to `not checked`;
//   - 8.6 on any unavailability (no key / network / endpoint error / timeout)
//     return `not checked` and state plainly, in English, that automated
//     feedback is unavailable so the learner self-judges.

/**
 * @typedef {import("./types.js").Scene} Scene
 * @typedef {import("./types.js").Verdict} Verdict
 */

// The matcher endpoint. Relative so it resolves against the page origin that the
// prototype server (server.js) also serves from.
const MATCH_ENDPOINT = "/api/match";

// How long to wait for the matcher before treating it as unavailable
// (Requirement 8.6: "no response within the request timeout"). 15s mirrors a
// generous ceiling for a single-call coach check.
const REQUEST_TIMEOUT_MS = 15000;

// Plain-English note shown whenever automated feedback is unavailable
// (Requirement 8.6). It never claims the attempt was wrong — it says the check
// could not run and points the learner at their own revealed reference line.
const UNAVAILABLE_NOTE =
  "Automated feedback isn't available right now. Compare your attempt with your own reference line below and judge it yourself.";

// The server's verdict set (server.js) is works|thin|missed|unchecked. The
// learner-facing Verdict set (design Data Models) is works|thin|missed|not
// checked. Everything else — including the server's `unchecked` — maps to
// `not checked`.
const KNOWN_LEARNER_VERDICTS = new Set(["works", "thin", "missed"]);

/**
 * Serialize a Scene object into the single English string the matcher endpoint
 * expects (server.js interpolates `scene` directly into its prompt). Only the
 * five app-authored English Scene parts are included; no learner French is added
 * here (the Scene is app-owned English by construction — Requirement 7.5).
 *
 * Accepts a string Scene unchanged (callers that already hold a framing string),
 * and tolerates a missing/partial Scene by omitting absent parts.
 *
 * @param {Scene|string|null|undefined} scene
 * @returns {string}
 */
function sceneToString(scene) {
  if (typeof scene === "string") return scene;
  if (!scene || typeof scene !== "object") return "";
  const parts = [
    ["Where", scene.where],
    ["You are", scene.you],
    ["You're talking to", scene.them],
    ["What you want", scene.want],
    ["What counts as done", scene.done],
  ];
  return parts
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

/**
 * Map a raw matcher verdict value onto the fixed learner-facing set. Any value
 * outside {works, thin, missed} — including the server's `unchecked`, unknown
 * strings, or non-strings — becomes `not checked` (Requirements 8.5, 8.2).
 *
 * @param {unknown} rawVerdict
 * @returns {"works"|"thin"|"missed"|"not checked"}
 */
function mapVerdict(rawVerdict) {
  return typeof rawVerdict === "string" && KNOWN_LEARNER_VERDICTS.has(rawVerdict)
    ? rawVerdict
    : "not checked";
}

/**
 * Extract the English coach note from a matcher response. The note field is, by
 * the server's contract, English feedback — it is kept as-is. Any French-bearing
 * fields the model may return (`suggest`, `structure`) are deliberately NOT read
 * here, so no model-generated French can reach the learner (Requirement 8.4).
 *
 * @param {object} data
 * @returns {string}
 */
function noteFrom(data) {
  return data && typeof data.note === "string" ? data.note : "";
}

/**
 * Build an unavailable Verdict (Requirement 8.6): `not checked`, a plain-English
 * availability message, and the learner's own reference line revealed so they
 * can self-judge.
 *
 * @param {string} referenceSourceLine
 * @returns {Verdict}
 */
function unavailableVerdict(referenceSourceLine) {
  return {
    kind: "not checked",
    note: UNAVAILABLE_NOTE,
    reference: typeof referenceSourceLine === "string" ? referenceSourceLine : "",
  };
}

/**
 * Judge a learner's Say-it attempt against their own reference Source_Line.
 *
 * Sends only `{ scene, accepted:[referenceSourceLine], utterance, vocab }` to the
 * existing `/api/match` endpoint (Requirements 8.1, 12.4 — no other
 * Learner_Content is included). Maps the response verdict into the fixed set,
 * keeps only the English note, discards any model-generated French, and always
 * reveals the learner's own `referenceSourceLine` labelled as a reference
 * (Requirements 8.2–8.5). On any unavailability — no API key configured (the
 * server replies 503 `no_key`), a network or endpoint error, or no response
 * within the request timeout — it returns `not checked` with a plain-English
 * availability message so the learner self-judges (Requirement 8.6).
 *
 * This function performs the single matcher network call and nothing else; it is
 * otherwise free of side effects.
 *
 * @param {string} utterance  The learner's spoken/typed attempt.
 * @param {string} referenceSourceLine  The learner's own reference line (verbatim).
 * @param {Scene|string} scene  The Scene framing (English).
 * @param {string[]} [vocab]  Phrases the learner has met today (English/French
 *   the learner already saw); defaults to empty. Only this restricted payload is
 *   sent (Requirement 12.4).
 * @returns {Promise<Verdict>}
 */
export async function judgeLearnerAttempt(utterance, referenceSourceLine, scene, vocab = []) {
  const requestBody = {
    scene: sceneToString(scene),
    accepted: [referenceSourceLine],
    utterance,
    vocab: Array.isArray(vocab) ? vocab : [],
  };

  // A timeout turns a hung request into an "unavailable" result (Requirement
  // 8.6). AbortController is used when available; the timer is always cleared.
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch(MATCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller ? controller.signal : undefined,
    });

    // Any non-OK HTTP status (e.g. 503 no_key, 400 bad_request, 5xx endpoint
    // error) is an unavailability — self-judge path (Requirement 8.6).
    if (!response.ok) {
      return unavailableVerdict(referenceSourceLine);
    }

    const data = await response.json();

    // The server returns 200 with verdict "unchecked" on quota/failure. That
    // maps to `not checked` via mapVerdict. When the server could not actually
    // check, surface the availability message rather than its internal note, so
    // the learner is told plainly that feedback is unavailable (Requirement 8.6).
    const kind = mapVerdict(data && data.verdict);
    if (kind === "not checked") {
      return unavailableVerdict(referenceSourceLine);
    }

    // A real verdict: keep ONLY the English note and the learner's own reference
    // line. Any model-generated French (`suggest`, `structure`) is discarded by
    // simply never reading it (Requirement 8.4).
    return {
      kind,
      note: noteFrom(data),
      reference: referenceSourceLine,
    };
  } catch (_err) {
    // Network error, abort/timeout, or a malformed JSON body — all unavailability
    // (Requirement 8.6). Never report a failure as `missed`.
    return unavailableVerdict(referenceSourceLine);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
