// importer.js — Content_Importer (provenance-in).
//
// Accepts raw learner text and normalizes it into Source_Lines, stamping
// provenance. This is the only place raw learner text enters the system.
//
// Task 2.1 (this file) implements the core of normalization:
//   - segment the input on sentence-ending punctuation (`.`, `!`, `?`, `…`) and
//     explicit line breaks, preserving the original order (Requirements 2.1, 2.2);
//   - trim outer whitespace only, leaving internal characters/accents/
//     contractions untouched (Requirements 2.3, 2.5, 10.4);
//   - discard whitespace-only segments (Requirement 2.6);
//   - stamp `provenance:"learner"` and a 0-based `index` on every Source_Line
//     (Requirement 2.4).
//
// Speaker attribution and the 5,000-character cap are Task 2.2 (this edit); the
// decline/warn result path is Task 2.3. The public `importContent` entry point
// remains a stub until Task 2.3 wires the pieces together. `segmentSourceLines`
// is the Task 2.1 deliverable; `capInput`, `detectSpeakerPrefix`, and
// `attributeSourceLines` are the Task 2.2 deliverables, all exported for use by
// later tasks and property tests.

/**
 * @typedef {import("./types.js").ImportResult} ImportResult
 * @typedef {import("./types.js").SourceLine} SourceLine
 */

// Sentence-ending punctuation the importer segments on, per Requirement 2.2.
// Kept as a character class so the split captures the terminator with the
// segment that precedes it (lookbehind), consistent with the prototype's
// `chunk()` splitter which also splits *after* `[,.!?…]`.
const SENTENCE_TERMINATORS = ".!?…";

// Split on an explicit line break (LF, CR, or CRLF) OR immediately after a
// sentence-ending terminator. The terminator stays attached to the segment that
// precedes it (via lookbehind), so "Salut ! Ça va ?" becomes ["Salut !", "Ça va ?"].
// Any run of whitespace following the terminator is consumed by the split so it
// does not leak into the next segment's leading edge (outer whitespace is
// trimmed regardless, but this keeps empty-segment handling clean).
const SEGMENT_SPLITTER = /(?<=[.!?…])|\r\n|\r|\n/;

// Maximum accepted input length, per Requirement 1.6. Input longer than this is
// truncated to the leading MAX_INPUT_CHARS characters (never failed silently,
// never silently accepted whole).
export const MAX_INPUT_CHARS = 5000;

// The separator characters that may follow a speaker label (Requirement 1.3).
const SPEAKER_SEPARATORS = ":-";

// A line is speaker-prefixed when it starts with a label of 1..20 characters,
// none of which is a separator or whitespace, followed immediately by a `:` or
// `-` separator. The label is captured in group 1 and the remainder in group 2.
//
// - `[^\s:-]` for the label forbids whitespace and the separators themselves, so
//   a leading `:`/`-` or a space before the separator never counts as a label
//   (those are the degenerate cases that must become unattributed, Req 1.5).
// - `{1,20}` enforces the 1..20 character bound (Requirement 1.3).
// - The separator is required; the remainder (group 2) is whatever follows and
//   may be empty (handled by the caller).
//
// - `\s*:` also accepts French typography, which puts a space before the colon
//   ("Camille : Salut").
// - `-` only counts when followed by whitespace (or end of line), so a hyphenated
//   word at the start of a line ("Excuse-moi, …") is never read as a speaker.
const SPEAKER_PREFIX = /^([^\s:-]{1,20})(?:\s*:|\s*-(?=\s|$))(.*)$/s;

// The single default learner speaker used when NO line in the content is
// speaker-prefixed (Requirement 1.4). Exported so later tasks/UI can reuse it.
export const DEFAULT_SPEAKER = "You";

// French-relevant character ranges, per Requirement 3.3: basic Latin letters
// (A–Z, a–z) and the Latin-1 Supplement / Latin Extended-A accented letters that
// cover French diacritics (é, à, ç, ô, î, ë, ï, ù, û, œ, …) and related European
// letters. The ranges \u00C0–\u024F span Latin-1 Supplement letters through
// Latin Extended-B start, which comfortably contains every French accented form.
const FRENCH_RELEVANT_CHARS = /[A-Za-z\u00C0-\u024F]/;

// Plain-English, learner-facing decline/warn messages (Requirement 3.1–3.3).
// These are the app's own English, never presented as the learner's French.
const MESSAGES = {
  empty: "Please paste or type some text first — there's nothing here to turn into practice yet.",
  too_few:
    "That's not quite enough to practise with yet. Add a bit more text so there are at least two sentences to work with.",
  not_french:
    "This doesn't look like French. You can keep going if you meant to, but check the text first.",
};

/**
 * Segment raw learner text into normalized Source_Lines.
 *
 * Pure function: no I/O, no network, no DOM. Preserves the original order of
 * appearance. Trims only outer whitespace from each segment, never touching
 * internal characters, accents, or casual-French contractions. Whitespace-only
 * segments are discarded. Every produced Source_Line is stamped with
 * `provenance:"learner"` and a 0-based `index` reflecting its position within
 * the surviving Source_Lines.
 *
 * Speaker attribution is deferred to Task 2.2; every Source_Line produced here
 * carries `speaker: null` and `en: ""` as placeholders that later tasks refine.
 *
 * @param {string} rawText  The learner's pasted plain text.
 * @returns {SourceLine[]}  Ordered, non-empty, outer-trimmed Source_Lines.
 */
export function segmentSourceLines(rawText) {
  if (typeof rawText !== "string" || rawText.length === 0) {
    return [];
  }

  const segments = rawText.split(SEGMENT_SPLITTER);

  /** @type {SourceLine[]} */
  const sourceLines = [];
  for (const segment of segments) {
    // Guard against `undefined` entries some split paths can yield.
    if (typeof segment !== "string") continue;

    // Trim OUTER whitespace only. `String#trim` removes leading/trailing
    // whitespace without altering any internal character, accent, or
    // contraction — exactly Requirement 2.5 / 10.4.
    const fr = segment.trim();

    // Discard whitespace-only (or empty) segments rather than producing an
    // empty Source_Line (Requirement 2.6).
    if (fr.length === 0) continue;

    sourceLines.push({
      speaker: null, // refined by speaker attribution in Task 2.2
      fr,
      en: "", // learner-supplied English is attached in a later task; never invented
      provenance: "learner", // Requirement 2.4
      index: sourceLines.length, // 0-based position among surviving lines
    });
  }

  return sourceLines;
}

/**
 * Enforce the maximum input length (Requirement 1.6).
 *
 * Keeps only the leading `MAX_INPUT_CHARS` characters and reports, via
 * `truncated`, whether the original input exceeded the cap. The input is never
 * failed silently and never silently accepted whole: a caller that sees
 * `truncated:true` is expected to tell the learner in plain English (Task 2.3).
 *
 * Pure function. Non-string input is treated as empty.
 *
 * @param {string} rawText  The learner's pasted plain text.
 * @returns {{ text: string, truncated: boolean }}  The capped text and whether
 *   truncation occurred.
 */
export function capInput(rawText) {
  if (typeof rawText !== "string") {
    return { text: "", truncated: false };
  }
  if (rawText.length > MAX_INPUT_CHARS) {
    return { text: rawText.slice(0, MAX_INPUT_CHARS), truncated: true };
  }
  return { text: rawText, truncated: false };
}

/**
 * Detect a leading speaker label on a single physical line (Requirements 1.3,
 * 1.5).
 *
 * A line is speaker-prefixed when it begins with a label of 1..20 characters —
 * none of which is whitespace or a separator — followed immediately by a `:` or
 * `-` separator. The remainder of the line (after the separator) is the content
 * attributed to that speaker.
 *
 * Degenerate prefixes (empty label, whitespace-only, or separator-only such as a
 * leading `:` / `-` / `--`) do NOT match: those lines are left whole and
 * unattributed (`speaker: null`), never producing an empty speaker.
 *
 * Pure function.
 *
 * @param {string} line  A single physical line (no embedded line breaks).
 * @returns {{ speaker: string, content: string } | null}  The detected speaker
 *   and remaining content, or `null` when the line is not speaker-prefixed.
 */
export function detectSpeakerPrefix(line) {
  if (typeof line !== "string") return null;

  const match = SPEAKER_PREFIX.exec(line);
  if (!match) return null;

  const label = match[1];
  // The label regex already forbids whitespace and separators, so a non-null
  // match guarantees a 1..20 char non-degenerate label. The remainder is
  // whatever followed the separator (may be empty / whitespace-only; the caller
  // segments and discards empties per Requirement 2.6).
  const content = match[2];
  return { speaker: label, content };
}

/**
 * Segment a single physical line (no embedded line breaks) on sentence-ending
 * punctuation only, applying the same outer-trim and discard-empty rules as
 * {@link segmentSourceLines}. Returns the surviving `fr` strings in order.
 *
 * @param {string} line  A single physical line.
 * @returns {string[]}  Outer-trimmed, non-empty segment strings in order.
 */
function segmentLineOnTerminators(line) {
  if (typeof line !== "string" || line.length === 0) return [];
  // Split only after a terminator; this line has no embedded line breaks.
  return line
    .split(/(?<=[.!?…])/)
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0);
}

/**
 * Normalize raw learner text into Source_Lines WITH speaker attribution and the
 * 5,000-character cap applied (Requirements 1.3, 1.4, 1.5, 1.6, plus the
 * segmentation/trim/provenance rules of 2.1–2.6, 10.4).
 *
 * Behavior:
 * - The input is first capped to the leading `MAX_INPUT_CHARS` characters; the
 *   returned `truncated` flag reports whether the cap was hit (Requirement 1.6).
 * - Attribution is a whole-content decision. Each physical line is inspected for
 *   a leading speaker prefix (see {@link detectSpeakerPrefix}). A prefixed line's
 *   segments are attributed to that label; the prefix is stripped from the `fr`.
 *   A non-prefixed (or degenerate-prefix) line's segments are left unattributed
 *   for now (Requirements 1.3, 1.5).
 * - If NO physical line in the whole content carried a well-formed speaker
 *   prefix, every Source_Line is attributed to the single `DEFAULT_SPEAKER`
 *   (Requirement 1.4). When at least one line is prefixed, lines without a prefix
 *   keep `speaker: null` (genuinely unattributed) rather than borrowing the
 *   default — the default is only for the "no speakers at all" case.
 * - Segmentation, outer-trim, discard-empty, provenance, and 0-based contiguous
 *   indexing match {@link segmentSourceLines} (Requirements 2.1–2.6, 10.4).
 *
 * Pure function: no I/O, no network, no DOM.
 *
 * @param {string} rawText  The learner's pasted plain text.
 * @param {{ defaultSpeaker?: string }} [options]  Optional override for the
 *   single default learner speaker used when no line is speaker-prefixed.
 * @returns {{ sourceLines: SourceLine[], truncated: boolean }}
 */
export function attributeSourceLines(rawText, options) {
  const defaultSpeaker =
    options && typeof options.defaultSpeaker === "string" && options.defaultSpeaker.length > 0
      ? options.defaultSpeaker
      : DEFAULT_SPEAKER;

  const { text, truncated } = capInput(rawText);

  if (text.length === 0) {
    return { sourceLines: [], truncated };
  }

  // Split into physical lines first so speaker prefixes are detected at true
  // line starts (a terminator mid-line must not reset the "line start").
  const physicalLines = text.split(/\r\n|\r|\n/);

  /** @type {Array<{ speaker: string|null, fr: string }>} */
  const pending = [];
  let anySpeakerPrefixed = false;

  for (const physicalLine of physicalLines) {
    const prefix = detectSpeakerPrefix(physicalLine);
    if (prefix) {
      anySpeakerPrefixed = true;
      // Attribute every segment of this physical line to the detected speaker.
      for (const fr of segmentLineOnTerminators(prefix.content)) {
        pending.push({ speaker: prefix.speaker, fr });
      }
    } else {
      // Not speaker-prefixed (or a degenerate prefix): keep the whole line,
      // unattributed for now (Requirement 1.5).
      for (const fr of segmentLineOnTerminators(physicalLine)) {
        pending.push({ speaker: null, fr });
      }
    }
  }

  /** @type {SourceLine[]} */
  const sourceLines = pending.map((entry, i) => ({
    // Requirement 1.4: when NO line is speaker-prefixed, every line gets the one
    // default speaker. Otherwise unattributed lines stay null (Requirement 1.5).
    speaker: anySpeakerPrefixed ? entry.speaker : defaultSpeaker,
    fr: entry.fr,
    en: "", // learner-supplied English attached in a later task; never invented
    provenance: "learner", // Requirement 2.4
    index: i, // 0-based contiguous position among surviving lines
  }));

  return { sourceLines, truncated };
}

/**
 * Import raw learner text into an ImportResult (Task 2.3).
 *
 * This is the public entry point. It aggregates the Task 2.1 segmentation and
 * Task 2.2 speaker attribution + length cap into a full ImportResult, and
 * implements the decline/warn result path (Requirement 3):
 *
 * - **empty** (Requirement 3.1): input that is empty or only whitespace is
 *   declined with `reason:"empty"` and a plain-English message that some text is
 *   needed.
 * - **too_few** (Requirement 3.2): input that yields fewer than 2 Source_Lines is
 *   declined with `reason:"too_few"`, honestly reporting the count found via
 *   `sourceLineCount`, and a plain-English message that more material is needed.
 * - **not_french** (Requirement 3.3): input containing no French-relevant
 *   characters (basic Latin letters or Latin-1/Latin-Extended accented letters)
 *   is warned with `reason:"not_french"` and `requiresConfirmation:true`, so the
 *   caller requires an explicit learner confirmation before continuing.
 * - **ok** otherwise: `{ ok:true, sourceLines, truncated }`.
 *
 * In every declined/warned case the learner's exact typed text is echoed back in
 * `preservedText` (`preservedText === rawText`) so it can be edited rather than
 * re-entered (Requirement 3.4). The caller keeps the Authored_Content path
 * available on decline (Requirement 3.5), which is a render-layer concern.
 *
 * Check order matters. "Empty" is checked first (an empty input is also trivially
 * not-French and too-few, but the clearest message is "add some text"). The
 * not-French warning is checked before "too_few" so that non-French input is
 * surfaced as the more specific, actionable warning rather than a generic
 * "add more" decline. The not-French check runs on the capped text — the same
 * text the Source_Lines are derived from — so the verdict matches what would be
 * imported.
 *
 * Pure function: no I/O, no network, no DOM.
 *
 * @param {string} rawText  The learner's pasted plain text.
 * @param {{ defaultSpeaker?: string }} [options]
 * @returns {ImportResult}
 */
export function importContent(rawText, options) {
  // Preserve the learner's exact typed text for every non-ok result
  // (Requirement 3.4). Non-string input is echoed back as an empty string so
  // `preservedText` is always a string the input box can be restored from.
  const preservedText = typeof rawText === "string" ? rawText : "";

  // 1. Empty / whitespace-only input (Requirement 3.1).
  if (preservedText.trim().length === 0) {
    return {
      ok: false,
      reason: "empty",
      message: MESSAGES.empty,
      sourceLineCount: 0,
      preservedText,
    };
  }

  // Segment + attribute + apply the 5,000-char cap (Tasks 2.1/2.2).
  const { sourceLines, truncated } = attributeSourceLines(rawText, options);

  // The capped text is what the Source_Lines were derived from; run the
  // French-relevant check against the same text so the verdict is consistent.
  const { text: cappedText } = capInput(rawText);

  // 2. Does-not-look-like-French warning (Requirement 3.3). Checked before
  // "too_few" so non-French input gets the specific, actionable warning.
  if (!FRENCH_RELEVANT_CHARS.test(cappedText)) {
    return {
      ok: false,
      reason: "not_french",
      message: MESSAGES.not_french,
      sourceLineCount: sourceLines.length,
      preservedText,
      requiresConfirmation: true,
    };
  }

  // 3. Fewer than 2 Source_Lines (Requirement 3.2) — report the honest count.
  if (sourceLines.length < 2) {
    return {
      ok: false,
      reason: "too_few",
      message: MESSAGES.too_few,
      sourceLineCount: sourceLines.length,
      preservedText,
    };
  }

  // 4. Accepted.
  return { ok: true, sourceLines, truncated };
}
