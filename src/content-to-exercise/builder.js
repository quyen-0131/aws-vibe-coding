// builder.js — Exercise_Builder (shape-out).
//
// A set of pure transforms from Source_Line[] into the four existing data shapes
// the Read/Build/Say-it/Done screens already consume. Never invents French: if a
// transform cannot complete without inventing French it emits its defined
// degraded form (zero word-cards, decoy-free Build, neutral default Scene).
//
// The transforms are implemented in Tasks 4 and 5. Task 1 establishes the module
// and signatures only. The no-invented-French invariant is backed by
// `isVerbatimSliceOf` from ./containment.js.

/**
 * @typedef {import("./types.js").SourceLine} SourceLine
 * @typedef {import("./types.js").Turn} Turn
 * @typedef {import("./types.js").WordCardMap} WordCardMap
 * @typedef {import("./types.js").Scene} Scene
 * @typedef {import("./types.js").Pool} Pool
 * @typedef {import("./types.js").BuiltSession} BuiltSession
 */

/**
 * Build the Read-step Transcript from Source_Lines (Task 4.1).
 *
 * Produces exactly one `Turn` `[speaker, fr, en]` per Source_Line, in the same
 * order as the input (Requirement 4.1). The transform is a pure re-presentation
 * of learner material — it never invents French:
 *
 * - `fr` is the Source_Line's `fr` reproduced verbatim, character for character
 *   (Requirements 4.1, 4.4). Nothing is added, removed, or altered.
 * - `en` is the learner-supplied English for that line, or the empty string `""`
 *   when the learner supplied none; the transform NEVER fabricates a translation
 *   (Requirement 4.2). Since `Turn` carries `en` as a string, a `null`/missing
 *   learner English is normalized to `""` here (the "no translation available"
 *   signal the Read screen renders in plain English).
 * - `speaker` matches the prototype `turns` shape, which carries a string label.
 *   An unattributed Source_Line (`speaker === null`) becomes the empty string
 *   `""` so the Turn's speaker stays a string without the app inventing a label.
 *
 * Pure function: no I/O, no network, no DOM.
 *
 * @param {SourceLine[]} sourceLines  The learner's normalized Source_Lines.
 * @returns {Turn[]}  One `[speaker, fr, en]` triple per Source_Line, in order.
 */
export function buildTranscript(sourceLines) {
  if (!Array.isArray(sourceLines)) return [];

  /** @type {Turn[]} */
  const turns = [];
  for (const line of sourceLines) {
    if (!line || typeof line.fr !== "string") continue;

    // Speaker label: a string as the Turn shape requires. An unattributed line
    // (null) carries no label, so use "" rather than inventing one.
    const speaker = typeof line.speaker === "string" ? line.speaker : "";

    // French: verbatim, exactly as supplied (Requirements 4.1, 4.4).
    const fr = line.fr;

    // English: the learner's own English for this line, or "" — never invented
    // (Requirement 4.2).
    const en = typeof line.en === "string" ? line.en : "";

    turns.push([speaker, fr, en]);
  }

  return turns;
}

// Word-card selection bounds (Requirement 5.1).
const MAX_WORD_CARDS = 12;
// Example-count bounds per card (Requirement 5.3).
const MAX_EXAMPLES_PER_CARD = 3;
// Candidate phrases are contiguous word runs of 1..3 words. 2–3 word pieces
// ("beaucoup de monde", "bien sûr") are preferred; single words are a fallback.
const MAX_PHRASE_WORDS = 3;
// Spread cards over the conversation: at most this many from any one line until
// every line has had a chance to contribute.
const MAX_CARDS_PER_LINE_FIRST_PASS = 1;

// A word is a run of letters, optionally joined by apostrophes or hyphens
// ("aujourd'hui", "J'ai", "week-end", "Excuse-moi"). Punctuation and digits are
// never part of a word, so a card can never be ":" or "?" or "libre ?".
const WORD = /\p{L}+(?:['’-]\p{L}+)*/gu;
const WORD_CHAR = /[\p{L}'’-]/u;

// French function words. On their own they make useless cards ("de", "Il",
// "et"), and a phrase must not END on one ("discuter de", "un café à").
const STOPWORDS = new Set((
  "le la les l un une des du de d au aux et ou mais donc or ni car à en dans " +
  "sur sous pour par avec sans chez vers entre je j tu il elle on nous vous ils " +
  "elles me m te t se s lui leur leurs mon ma mes ton ta tes son sa ses notre " +
  "nos votre vos ce cet cette ces c ça cela ne n pas que qu qui quoi dont où y " +
  "est es suis sont a as ai ont avons avez été être avoir était très plus moins " +
  "aussi si oui non tout tous toute toutes comme alors puis bon ah oh eh hein"
).split(" "));
// A phrase must not START on a connector either ("et de leurs", "de leur vie").
const CONNECTORS = new Set("et ou mais donc or ni car de d à que qu qui".split(" "));

/** Lowercase a word and drop an elided prefix ("j'ai" → "ai", "l'école" → "école"). */
function coreOf(word) {
  const lower = word.toLowerCase();
  const parts = lower.split(/['’]/);
  return parts.length > 1 && STOPWORDS.has(parts[0]) ? parts.slice(1).join("'") : lower;
}
function isStopword(word) {
  return STOPWORDS.has(word.toLowerCase()) || STOPWORDS.has(coreOf(word));
}

/**
 * Build an origin label for a Source_Line occurrence (Requirement 5.3): the
 * speaker plus the line's position within the Learner_Content. This is the
 * app's own English-ish label, NOT learner French — it never alters or copies
 * the French. Positions are shown 1-based for a learner-facing "line N" reading.
 *
 * @param {SourceLine} line
 * @returns {string}
 */
function originLabel(line) {
  const position = typeof line.index === "number" ? line.index + 1 : 1;
  const who =
    typeof line.speaker === "string" && line.speaker.length > 0
      ? line.speaker
      : "Unattributed";
  return `${who} · line ${position}`;
}

/**
 * Split a Source_Line's `fr` into word tokens with their exact slice offsets, so
 * candidate phrases are VERBATIM substrings of the original `fr`. Each token also
 * records whether it starts a sentence (first word, or right after . ! ? …), which
 * is how a capitalised word is told apart from a name.
 *
 * @param {string} fr
 * @returns {Array<{ start: number, end: number, text: string, sentenceStart: boolean }>}
 */
function wordSpans(fr) {
  const spans = [];
  for (const m of fr.matchAll(WORD)) {
    const prevEnd = spans.length ? spans[spans.length - 1].end : 0;
    const sentenceStart = spans.length === 0 || /[.!?…]/.test(fr.slice(prevEnd, m.index));
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[0], sentenceStart });
  }
  return spans;
}

/** True when `phrase` occurs in `fr` as whole words (not inside another word). */
function containsWords(fr, phrase) {
  for (let at = fr.indexOf(phrase); at >= 0; at = fr.indexOf(phrase, at + 1)) {
    const prev = at > 0 && WORD_CHAR.test(fr[at - 1]);
    const next = at + phrase.length < fr.length && WORD_CHAR.test(fr[at + phrase.length]);
    if (!prev && !next) return true;
  }
  return false;
}

/**
 * Enumerate the candidate phrases worth a card from one Source_Line. A candidate
 * is a run of 1..3 words separated only by spaces (never across a comma or other
 * punctuation), sliced verbatim from `fr` (Requirement 5.2). Rejected:
 *   - anything containing a name (a speaker label, or a capitalised word that
 *     does not start a sentence — "Camille", "Léa", "Paris");
 *   - a single function word ("de", "Il"), or a single word under 3 letters;
 *   - a multi-word run that ends on a function word or starts on a connector,
 *     or that is all function words.
 *
 * @param {SourceLine} line
 * @param {Set<string>} names  Lowercased speaker labels to exclude.
 * @returns {Array<{ phrase: string, words: string[], positions: number[] }>}
 */
function candidatePhrasesFrom(line, names) {
  const fr = line.fr;
  const spans = wordSpans(fr);
  const isName = (s) =>
    names.has(s.text.toLowerCase()) ||
    (!s.sentenceStart && /^\p{Lu}/u.test(s.text) && !isStopword(s.text));
  const out = [];

  for (let i = 0; i < spans.length; i++) {
    for (let n = 1; n <= MAX_PHRASE_WORDS && i + n <= spans.length; n++) {
      const run = spans.slice(i, i + n);
      // Only spaces between the words — a phrase never straddles punctuation.
      if (n > 1 && !/^\s+$/.test(fr.slice(run[n - 2].end, run[n - 1].start))) break;
      if (run.some(isName)) continue;
      const words = run.map((s) => s.text);
      if (words.every(isStopword)) continue;
      if (n === 1 && coreOf(words[0]).length < 3) continue;
      if (n > 1 && (isStopword(words[n - 1]) || CONNECTORS.has(coreOf(words[0])))) continue;
      out.push({
        phrase: fr.slice(run[0].start, run[n - 1].end),
        words,
        positions: run.map((_, k) => i + k),
      });
    }
  }
  return out;
}

/**
 * Count how many Source_Lines contain `phrase` as whole words, and gather up to
 * MAX_EXAMPLES_PER_CARD example occurrences labelled with their origin
 * (Requirement 5.3). Examples draw their `fr` verbatim from the Source_Line that
 * contains the phrase — the whole line is the real usage context, exactly like
 * the prototype's `usesOf`.
 *
 * @param {string} phrase
 * @param {SourceLine[]} sourceLines
 * @returns {{ occurrences: number, examples: Array<{ fr: string, en: string, src: string }> }}
 */
function gatherExamples(phrase, sourceLines) {
  /** @type {Array<{ fr: string, en: string, src: string }>} */
  const examples = [];
  let occurrences = 0;
  for (const line of sourceLines) {
    if (!line || typeof line.fr !== "string") continue;
    if (!containsWords(line.fr, phrase)) continue;
    occurrences++;
    if (examples.length < MAX_EXAMPLES_PER_CARD) {
      examples.push({
        fr: line.fr, // verbatim learner French (the real usage context)
        en: typeof line.en === "string" ? line.en : "", // learner's own English or ""
        src: originLabel(line), // app-authored origin label (speaker + position)
      });
    }
  }
  return { occurrences, examples };
}

/**
 * Select learner word-cards from Source_Lines (Task 4.2).
 *
 * Produces a WordCardMap keyed by phrase, where every phrase is a VERBATIM slice
 * of at least one Source_Line (Requirements 5.1, 5.2). The transform never
 * invents French:
 *
 * - Candidates are 1..3-word runs lifted by offset from each Source_Line's `fr`
 *   (see candidatePhrasesFrom for what is filtered out: names, punctuation,
 *   lone function words, phrases ending on a function word).
 * - Ranking favours phrases that recur across lines (real recurring usage), then
 *   phrases with more meaningful words, then 2–3 word phrases over single words,
 *   then earlier appearance — a stable, deterministic order.
 * - Cards are spread over the conversation (one per line first, then more) and
 *   never overlap: once words in a line are on a card, another card covering
 *   any of those same words is skipped.
 * - Each card carries 1..3 examples drawn verbatim from the learner's own
 *   Source_Lines, each labelled with its origin (speaker + position)
 *   (Requirement 5.3).
 * - The learner supplies no gloss, so `en` and `note` are `null`; the phrase and
 *   its examples are still present, and no French is fabricated (Requirement 5.5).
 * - If there is no qualifying phrase (empty/invalid input), zero cards are
 *   returned rather than fabricating one (Requirement 5.6).
 *
 * Pure function: no I/O, no network, no DOM.
 *
 * @param {SourceLine[]} sourceLines  The learner's normalized Source_Lines.
 * @returns {WordCardMap}  0..12 word-cards keyed by verbatim phrase.
 */
export function selectWordCards(sourceLines) {
  /** @type {WordCardMap} */
  const cards = {};
  if (!Array.isArray(sourceLines) || sourceLines.length === 0) return cards;

  const names = new Set(
    sourceLines
      .map((l) => (l && typeof l.speaker === "string" ? l.speaker.toLowerCase() : ""))
      .filter(Boolean)
  );

  // 1. Enumerate unique candidates, keeping the line + word positions of their
  //    first appearance (used to spread cards and prevent overlap).
  const scored = [];
  const seen = new Set();
  sourceLines.forEach((line, lineNo) => {
    if (!line || typeof line.fr !== "string" || line.fr.length === 0) return;
    for (const c of candidatePhrasesFrom(line, names)) {
      if (seen.has(c.phrase)) continue;
      seen.add(c.phrase);
      const { occurrences, examples } = gatherExamples(c.phrase, sourceLines);
      scored.push({
        phrase: c.phrase, examples, occurrences,
        contentWords: c.words.filter((w) => !isStopword(w)).length,
        multiWord: c.words.length > 1 ? 1 : 0,
        lineNo, positions: c.positions, appearance: scored.length,
      });
    }
  });
  if (scored.length === 0) return cards;

  // 2. Rank by a balanced score — meaningful words, a bonus for a real 2–3 word
  //    phrase, a bonus for recurring across lines — then earlier appearance.
  //    So "beaucoup de monde" beats a bare "beaucoup" that merely recurs.
  const score = (e) => e.contentWords + e.multiWord + 1.5 * (e.occurrences - 1);
  scored.sort((a, b) => score(b) - score(a) || a.appearance - b.appearance);

  // 3. Pick without overlap, one card per line first so the cards cover the
  //    whole conversation, then fill up to MAX_WORD_CARDS.
  const used = new Set(); // "lineNo:position" of words already on a card
  const perLine = new Map();
  for (const limit of [MAX_CARDS_PER_LINE_FIRST_PASS, Infinity]) {
    for (const entry of scored) {
      if (Object.keys(cards).length >= MAX_WORD_CARDS) return cards;
      if (cards[entry.phrase] || entry.examples.length === 0) continue;
      if ((perLine.get(entry.lineNo) || 0) >= limit) continue;
      if (entry.positions.some((p) => used.has(entry.lineNo + ":" + p))) continue;
      cards[entry.phrase] = {
        phrase: entry.phrase, // verbatim slice (Requirement 5.2)
        en: null, // no learner gloss supplied → null, not fabricated (Requirement 5.5)
        note: null, // no learner note supplied → null
        examples: entry.examples, // 1..3, verbatim fr, origin-labelled (Requirement 5.3)
      };
      entry.positions.forEach((p) => used.add(entry.lineNo + ":" + p));
      perLine.set(entry.lineNo, (perLine.get(entry.lineNo) || 0) + 1);
    }
  }
  return cards;
}

/**
 * Build word-cards from an externally suggested phrase list — the opt-in Gemini
 * phrase picker (Requirement 12.6). The suggestions are UNTRUSTED: a phrase is
 * kept only if it occurs as whole words, verbatim, in at least one Source_Line,
 * so a model can choose among the learner's own words but can never add French
 * (Requirement 5.2). Duplicates are dropped; at most MAX_WORD_CARDS are kept, in
 * the order suggested. Returns `{}` when nothing survives, so the caller falls
 * back to {@link selectWordCards}.
 *
 * Pure function: no I/O, no network, no DOM.
 *
 * @param {unknown} phrases  Suggested phrases (anything non-string is ignored).
 * @param {SourceLine[]} sourceLines
 * @returns {WordCardMap}
 */
export function wordCardsFromPhrases(phrases, sourceLines) {
  /** @type {WordCardMap} */
  const cards = {};
  if (!Array.isArray(phrases) || !Array.isArray(sourceLines)) return cards;
  for (const raw of phrases) {
    if (Object.keys(cards).length >= MAX_WORD_CARDS) break;
    if (typeof raw !== "string") continue;
    const phrase = raw.trim();
    if (!phrase || cards[phrase]) continue;
    const { examples } = gatherExamples(phrase, sourceLines);
    if (examples.length === 0) continue; // not in the learner's text → discarded
    cards[phrase] = { phrase, en: null, note: null, examples };
  }
  return cards;
}

/**
 * The prototype's `chunk(sentence)` splitter, reused unchanged (Requirement 6.1,
 * design "Source material"). Reproduces `weekend-mission-prototype.html`'s logic
 * exactly:
 *
 *   1. Split the sentence after each sentence/clause terminator (`,` `.` `!` `?`
 *      `…`) followed by whitespace — the lookbehind keeps the terminator attached
 *      to its clause — and drop any empty parts.
 *   2. Within each part, group words into pieces of 2 words (or 3 words when the
 *      part runs longer than 6 words), joined by a single space.
 *
 * Every emitted piece is built from the sentence's own words in order, so the
 * ordered word sequence of the chunks reconstructs the sentence's word sequence.
 *
 * @param {string} sentence
 * @returns {string[]}  The sentence's target chunks, in order.
 */
function chunk(sentence) {
  const parts = sentence.split(/(?<=[,.!?…])\s+/).filter(Boolean);
  const out = [];
  parts.forEach((part) => {
    const w = part.split(/\s+/);
    const size = w.length > 6 ? 3 : 2;
    for (let i = 0; i < w.length; i += size) out.push(w.slice(i, i + size).join(" "));
  });
  return out;
}

/**
 * Produce the verbatim target Chunks for a Source_Line (Task 5.1).
 *
 * Reuses the prototype's `chunk()` splitter unchanged (Requirement 6.1) so the
 * Build step segments a learner line exactly the way it segments authored lines.
 * The Chunks are built from the Source_Line's own words in order — the transform
 * never invents French; it only re-presents the learner's own words as pieces.
 *
 * Pure function: no I/O, no network, no DOM.
 *
 * @param {SourceLine} sourceLine  The Source_Line selected for the Build step.
 * @returns {string[]}  The ordered target Chunks for that Source_Line.
 */
export function chunksOf(sourceLine) {
  if (!sourceLine || typeof sourceLine.fr !== "string") return [];
  return chunk(sourceLine.fr);
}

// Maximum number of Decoy Chunks added to a Build pool (Requirement 6.4), so
// that `pool.length <= target.length + 4`.
const MAX_DECOYS = 4;

/**
 * Build the Build-step chip Pool for the Source_Line at `targetIndex` (Task 5.2).
 *
 * Produces `{ target, pool }` where:
 *
 * - `target` is the ordered target Chunks of the selected Source_Line, produced
 *   by the existing `chunk()` splitter via `chunksOf` (Requirement 6.1). Every
 *   chunk is a verbatim slice of the learner's own line.
 * - `pool` is the target Chunks plus 0..MAX_DECOYS (4) Decoy Chunks, so the pool
 *   size is at most `target.length + 4` (Requirement 6.4).
 *
 * Decoy provenance and exclusion:
 *
 * - Decoys are drawn ONLY from *other* Source_Lines within the same
 *   Learner_Content — never the selected line, never Authored_Content, never
 *   generated French (Requirements 6.2, 6.6). Every decoy is therefore a verbatim
 *   slice of some learner line.
 * - A decoy is excluded when its trimmed, case-sensitive, accent-preserving text
 *   equals any target Chunk under the same trimmed comparison (Requirement 6.3),
 *   so a chip that would duplicate a correct piece never appears.
 * - Duplicate decoy chunks (across other lines, or already added) are collapsed
 *   so the same chip is not offered twice.
 *
 * No-other-line case: when the Learner_Content yields no *other* Source_Line to
 * draw from, the pool equals the target Chunks alone with zero decoys — the
 * transform does not fabricate French to fill the pool (Requirement 6.6).
 *
 * Ordering: the pool is arranged by a deterministic, index-seeded order (mirroring
 * the prototype's `poolFor` shuffle) so the output is a pure function of its
 * inputs — no `Math.random`, no I/O, no network, no DOM.
 *
 * @param {number} targetIndex  Index into `sourceLines` of the line to build.
 * @param {SourceLine[]} sourceLines  The learner's normalized Source_Lines.
 * @returns {Pool}  `{ target, pool }` of verbatim chunk strings.
 */
export function buildPool(targetIndex, sourceLines) {
  if (!Array.isArray(sourceLines) || sourceLines.length === 0) {
    return { target: [], pool: [] };
  }

  const targetLine = sourceLines[targetIndex];
  const target = chunksOf(targetLine);

  // No valid target line → nothing to build (defensive; keeps the shape).
  if (target.length === 0) {
    return { target: [], pool: [] };
  }

  // Target chunks under the trimmed, case-sensitive, accent-preserving comparison
  // used to exclude duplicate decoys (Requirement 6.3). Trimming only normalizes
  // outer whitespace; casing and accents are preserved exactly.
  const targetKeys = new Set(target.map((c) => c.trim()));

  // Gather candidate decoy chunks from EVERY OTHER Source_Line, in order
  // (Requirements 6.2, 6.6). Exclude any that equal a target chunk, and collapse
  // duplicates so no chip is offered twice.
  //
  // Which other lines, in what order: the Build screen shows the two lines
  // before the target as context, so decoys from those (or the very next line)
  // would be recognisable and make the exercise look like the previous one.
  // Far lines come first, starting a few lines ahead and wrapping round; the
  // nearby lines are only a fallback for short texts. Decoys are then taken
  // round-robin — one chunk per line — so they come from several lines.
  const n = sourceLines.length;
  const nearby = new Set([targetIndex - 2, targetIndex - 1, targetIndex + 1]);
  const far = [], near = [];
  for (let k = 0; k < n; k++) {
    const i = (targetIndex + 3 + k) % n;
    if (i === targetIndex) continue; // decoys come only from OTHER lines
    (nearby.has(i) ? near : far).push(i);
  }
  const lineChunks = [...far, ...near].map((i) => chunksOf(sourceLines[i]));

  /** @type {string[]} */
  const decoys = [];
  const decoySeen = new Set();
  const longest = Math.max(0, ...lineChunks.map((c) => c.length));
  for (let j = 0; j < longest; j++) {
    for (const chunks of lineChunks) {
      const chunkStr = chunks[j];
      if (chunkStr === undefined) continue;
      const key = chunkStr.trim();
      if (targetKeys.has(key)) continue; // excludes a decoy equal to a target
      if (decoySeen.has(key)) continue; // collapse duplicate decoys
      decoySeen.add(key);
      decoys.push(chunkStr);
    }
  }

  // Include between 0 and 4 decoys so pool.length <= target.length + 4
  // (Requirement 6.4). When there is no other line, `decoys` is empty and the
  // pool is the target chunks alone (Requirement 6.6).
  const chosenDecoys = decoys.slice(0, MAX_DECOYS);

  // Deterministic ordering of the combined chips (mirrors the prototype's
  // `poolFor` seeded sort), keeping buildPool a pure function of its inputs.
  const safeIndex = Number.isInteger(targetIndex) ? targetIndex : 0;
  const pool = [...target, ...chosenDecoys]
    .map((c, n) => ({ c, o: (safeIndex * 7 + n * 13 + c.length * 3) % 97 }))
    .sort((a, b) => a.o - b.o)
    .map((x) => x.c);

  return { target, pool };
}

/**
 * The neutral default Scene (Requirement 7.3). Five app-authored English parts
 * whose success condition is "keeping the conversation going" (PRD §16.1). This
 * Scene fabricates no specifics about the learner's material: it frames a generic
 * exchange so the learner always has a complete, honest five-part setup even when
 * the content gives nothing concrete to build a specific scene from.
 *
 * Every value is the app's own English. No part contains Learner_Content French —
 * these strings are constants independent of the input (Requirements 7.2, 7.5).
 *
 * @type {Readonly<Scene>}
 */
const NEUTRAL_DEFAULT_SCENE = Object.freeze({
  where: "A relaxed, everyday conversation — somewhere you feel comfortable talking.",
  you: "You — practising with your own material, saying what you actually mean.",
  them: "A friendly French speaker who is happy to chat and listens patiently.",
  want: "To get your point across in French and keep the exchange going naturally.",
  done: "You keep the conversation going — there's always something more to say.",
});

/**
 * Build the five-part Scene framing shown before the Say-it step (Task 5.3).
 *
 * The Scene is app-authored English framing, NOT learner French (Requirement 7.2).
 * Requirement 7.1 asks for all five parts (`where`, `you`, `them`, `want`, `done`)
 * populated and non-empty; Requirement 7.3 says that WHERE the five parts cannot
 * be populated from concrete references in the Learner_Content, the System presents
 * a neutral default Scene whose success condition is keeping the conversation going,
 * rather than fabricating specifics; Requirement 7.5 forbids copying or translating
 * any Learner_Content French into the Scene text.
 *
 * Source_Lines carry only French (`fr`) plus optional learner-chosen speaker labels.
 * The French cannot enter the Scene (that would copy/translate learner French,
 * violating 7.5), and there is no concrete English reference in the material from
 * which to author scene-specific `where`/`you`/`them`/`want` text without inventing
 * specifics. So the five parts cannot be populated from concrete references, and the
 * transform emits the neutral default Scene (Requirement 7.3) — five non-empty,
 * app-owned English parts with "keep the conversation going" as the success
 * condition (Requirement 7.1). This also guarantees no Source_Line French appears
 * in any Scene part (Requirement 7.5, design Property 12).
 *
 * A fresh copy of the frozen default is returned so callers can safely treat the
 * Scene as mutable plain data without affecting the shared constant.
 *
 * Pure function: no I/O, no network, no DOM. The output does not depend on the
 * input contents, by design — the Scene is never derived from learner French.
 *
 * @param {SourceLine[]} sourceLines  The learner's normalized Source_Lines (unused
 *   for content; the Scene is app-authored English, never built from learner French).
 * @returns {Scene}  The neutral default five-part English Scene.
 */
export function buildScene(sourceLines) {
  // The five parts cannot be populated from concrete references without inventing
  // specifics or copying/translating learner French, so emit the neutral default
  // Scene (Requirements 7.1, 7.2, 7.3, 7.5). Return a fresh copy of the constant.
  return { ...NEUTRAL_DEFAULT_SCENE };
}

/**
 * Plain-English reasons for every build step that fell back to its defined
 * degraded form (Task 9.4, Requirement 10.5).
 *
 * Requirement 10.5 says that when a transformation step cannot complete without
 * inventing French, the System halts that step, leaves already-recorded learner
 * material unchanged, and informs the learner IN PLAIN ENGLISH why the step could
 * not complete — rather than fabricating French. The transforms themselves already
 * emit the defined degraded form (zero Word_Cards, a decoy-free Build pool, the
 * neutral default Scene); this helper reports, in learner-facing English, which of
 * those fallbacks were taken so the UI can surface the reason.
 *
 * It is a pure, read-only observation of the SAME transform outputs the session
 * renders — it never mutates the Source_Lines or the BuiltSession, invents no
 * French, and returns only English sentences the app owns. The checks are:
 *
 * - **Zero Word_Cards** (Requirement 5.6): the content yielded no phrase that
 *   occurs verbatim in a Source_Line, so no card could be made without inventing
 *   one. Reported only when there IS learner material to draw from (a card could
 *   in principle have been made) — an empty Source_Line list is the no-content
 *   case, not a degraded build step.
 * - **Decoy-free Build pool** (Requirement 6.6): at least one Build pool equals
 *   its target Chunks alone because there was no OTHER Source_Line to draw a decoy
 *   from. The pool is honest (real chunks, no fabricated distractors); the reason
 *   explains why there are no extra chips.
 * - **Neutral default Scene** (Requirement 7.3): the five Scene parts could not be
 *   populated from concrete references without inventing specifics or copying
 *   learner French, so the general-purpose Scene (success = keep the conversation
 *   going) is shown instead.
 *
 * Each returned string is plain English, carries no internal field/component
 * names (Requirement 11.5), and contains no French. The order is stable
 * (word-cards, then Build, then Scene) so the output is a pure function of input.
 *
 * @param {SourceLine[]} sourceLines  The learner's normalized Source_Lines.
 * @returns {string[]}  Zero or more plain-English reasons; empty when no step
 *   fell back to a degraded form.
 */
export function degradedReasons(sourceLines) {
  const lines = Array.isArray(sourceLines) ? sourceLines : [];
  /** @type {string[]} */
  const reasons = [];

  // Only lines that actually carry French can feed a transform.
  const usableLines = lines.filter(
    (l) => l && typeof l.fr === "string" && l.fr.trim().length > 0
  );

  // --- Zero Word_Cards (Requirement 5.6) ---
  // Degraded only when there WAS material to draw a card from but none could be
  // made verbatim. With no usable lines there is simply nothing to build from —
  // that is the empty-content case, not a halted build step.
  if (usableLines.length > 0) {
    const cards = selectWordCards(lines);
    if (Object.keys(cards).length === 0) {
      reasons.push(
        "No word cards this time — we couldn't pull any phrases from your text " +
          "without changing your words, so we left them exactly as you wrote them."
      );
    }
  }

  // --- Decoy-free Build pool (Requirement 6.6) ---
  // A pool is decoy-free when it equals its target chunks alone because there is
  // no OTHER Source_Line to supply a distractor chip. Report once if any
  // buildable line ends up with no decoys.
  let anyBuildable = false;
  let anyDecoyFree = false;
  for (let i = 0; i < lines.length; i++) {
    const { target, pool } = buildPool(i, lines);
    if (target.length === 0) continue; // not a buildable line
    anyBuildable = true;
    if (pool.length === target.length) anyDecoyFree = true;
  }
  if (anyBuildable && anyDecoyFree) {
    reasons.push(
      "The build step has no extra word chips to mix in — there wasn't enough " +
        "other text to draw distractors from, so you'll only see your own words."
    );
  }

  // --- Neutral default Scene (Requirement 7.3) ---
  // buildScene always returns the neutral default because Source_Lines carry no
  // concrete English reference to build a specific scene from without inventing
  // specifics or copying learner French. Surface that only when there is content
  // for which a scene is shown at all.
  if (usableLines.length > 0) {
    reasons.push(
      "The scene uses our general practice setup — your text didn't give us " +
        "specific details to build a custom scene, so we kept it neutral."
    );
  }

  return reasons;
}

/**
 * Aggregate the four Exercise_Builder transforms into a single `BuiltSession`
 * (Task 5.4) whose fields match, exactly, the shapes the existing
 * Read/Build/Say-it/Done screens already consume — so the render layer needs no
 * learner-built-specific branch (Requirement 11.2, design Property 15):
 *
 * - `transcript`: a `Turn[]` of `[speaker, fr, en]` triples, matching the
 *   prototype `WEEKENDS[key].turns` shape consumed by the Read screen
 *   (via {@link buildTranscript}).
 * - `wordCards`: a `WordCardMap` keyed by phrase (`{ phrase: { en, note, examples } }`),
 *   matching the prototype `PHRASES` shape consumed by the Read word-card popup
 *   (via {@link selectWordCards}).
 * - `scene`: a `Scene` of `{ where, you, them, want, done }`, matching the
 *   prototype `SCENE` shape consumed by the Say-it framing (via {@link buildScene}).
 * - `buildFor(index)`: a function returning the Build-step `Pool`
 *   `{ target, pool }` of chunk strings for the Source_Line at `index`, mirroring
 *   the prototype's `poolFor(turnIndex)` (via {@link buildPool}).
 *
 * `buildFor` closes over the SAME `sourceLines` passed here, so decoys are always
 * drawn from the learner's own other Source_Lines (Requirement 6.2) and the pool
 * stays a pure function of `(index, sourceLines)`. The composition itself invents
 * no French: every French string in `transcript`, `wordCards`, and each
 * `buildFor(index)` result is a verbatim slice of some Source_Line, and the Scene
 * is app-authored English carrying no learner French (design Property 1).
 *
 * The transforms each tolerate empty/invalid input by emitting their defined
 * degraded form (empty transcript, zero word-cards, neutral default Scene,
 * empty pools), so `buildExercises` returns a well-formed `BuiltSession` even for
 * an empty Source_Line list rather than throwing.
 *
 * When any step falls back to its degraded form, the session also carries
 * `degradedReasons`: plain-English sentences explaining why (Task 9.4,
 * Requirement 10.5). These are the app's own English — they never fabricate
 * French and never alter the already-recorded learner material — so the render
 * layer can surface the reason alongside the degraded shape rather than failing
 * silently or inventing content to fill the gap.
 *
 * Pure function: no I/O, no network, no DOM. `buildFor` is likewise pure.
 *
 * @param {SourceLine[]} sourceLines  The learner's normalized Source_Lines.
 * @param {{ phrases?: string[] }} [options]  Opt-in Gemini phrase suggestions,
 *   already fetched by the host; verified by {@link wordCardsFromPhrases}.
 * @returns {BuiltSession}  The four existing shapes the screens consume, plus a
 *   `degradedReasons` string[] (empty when no step degraded).
 */
export function buildExercises(sourceLines, options) {
  const lines = Array.isArray(sourceLines) ? sourceLines : [];
  // Opt-in Gemini suggestions (Requirement 12.6), verified verbatim; the local
  // selector is used when there are none or none survive verification.
  const suggested = wordCardsFromPhrases(options && options.phrases, lines);

  return {
    // Read: one [speaker, fr, en] turn per Source_Line, in order.
    transcript: buildTranscript(lines),
    // Read word-card popup: 0..12 verbatim-phrase cards keyed by phrase.
    wordCards: Object.keys(suggested).length ? suggested : selectWordCards(lines),
    // Say-it framing: five app-authored English parts (neutral default Scene).
    scene: buildScene(lines),
    // Build: pool for the Source_Line at `index`, decoys from the learner's own
    // other lines. Mirrors the prototype's poolFor(turnIndex).
    buildFor: (index) => buildPool(index, lines),
    // Req 10.5: plain-English reason(s) for any step that fell back to its
    // defined degraded form — empty when nothing degraded.
    degradedReasons: degradedReasons(lines),
  };
}
