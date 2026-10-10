// test-harness.js — shared fast-check generators for content-to-exercise.
//
// This is the reusable property-based testing harness for the feature. Later
// property-test tasks (Properties 1..16) import these generators so every
// property runs over the same intelligently-constrained input space.
//
// Design "Testing Strategy" calls for:
//   - a Learner_Content generator: multi-line French-ish text mixing accented
//     characters, casual contractions, the sentence terminators `. ! ? …`, line
//     breaks, optional speaker prefixes (`Label:` / `Label-`), and degenerate
//     labels (empty / whitespace-only / separator-only) to exercise Property 5;
//   - an edge-input generator: empty/whitespace-only strings, single-sentence
//     inputs, over-5,000-character strings, and non-Latin-only strings.
//
// Generators are "smart": they build from French-ish fragments and real
// structural features (terminators, line breaks, speaker prefixes) rather than
// arbitrary noise, so they stay inside the input space the importer is meant to
// handle while still covering the degenerate corners the properties care about.
//
// This module exports fast-check Arbitraries. It performs no I/O.

import fc from "fast-check";

// --- French-ish building blocks ---------------------------------------------

// Small French-ish clauses carrying accents and casual-French contractions.
// Deliberately verbatim, human-written French (no generation at runtime in the
// product; these are only test fixtures).
const FRENCH_CLAUSES = [
  "Salut ça va",
  "t'as passé un bon week-end",
  "j'ai pas eu le temps",
  "on s'est baladés le long de la rivière",
  "il faisait un temps magnifique",
  "franchement c'était tranquille",
  "je suis à peine sorti de chez moi",
  "ô là là quelle histoire",
  "ça m'a fait plaisir de te voir",
  "on va se refaire ça bientôt",
  "c'était plutôt sympa",
  "j'étais crevé après la randonnée",
];

// Sentence terminators the importer segments on, per Requirement 2.2.
const TERMINATORS = [".", "!", "?", "…"];

// Degenerate speaker labels for Property 5's unattributed path.
const DEGENERATE_LABELS = ["", "   ", ":", "-", " : ", "--"];

// Non-Latin-only snippets for the not-French path (Requirement 3.3).
const NON_LATIN = ["日本語のテキスト", "привет мир", "你好世界", "😀🎉✨", "١٢٣٤٥"];

// --- helpers ----------------------------------------------------------------

/** An Arbitrary for a non-degenerate speaker label of 1..20 chars (letters/digits). */
const labelArb = fc
  .stringMatching(/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 ]{0,19}$/)
  .filter((s) => s.length >= 1 && s.length <= 20 && !/^[\s:-]+$/.test(s));

/** An Arbitrary for a single French-ish sentence ending in a terminator. */
const sentenceArb = fc
  .tuple(fc.constantFrom(...FRENCH_CLAUSES), fc.constantFrom(...TERMINATORS))
  .map(([clause, term]) => clause + term);

/**
 * An Arbitrary for one line of a transcript. A line may be:
 *   - a bare sentence (unattributed, no prefix),
 *   - a well-formed speaker-prefixed line `Label: sentence` or `Label- sentence`,
 *   - a degenerate-label line (empty/whitespace/separator-only prefix) which the
 *     importer must treat as unattributed (Property 5).
 */
const lineArb = fc.oneof(
  // bare sentence
  sentenceArb,
  // well-formed speaker prefix
  fc
    .tuple(labelArb, fc.constantFrom(":", "-"), sentenceArb)
    .map(([label, sep, sentence]) => `${label}${sep} ${sentence}`),
  // degenerate label prefix
  fc
    .tuple(fc.constantFrom(...DEGENERATE_LABELS), sentenceArb)
    .map(([label, sentence]) => `${label} ${sentence}`)
);

// --- public generators -------------------------------------------------------

/**
 * Learner_Content generator: multi-line French-ish text with accents,
 * contractions, terminators, line breaks, optional speaker prefixes, and
 * degenerate labels. Produces 1..12 lines joined by `\n` (occasionally with
 * extra blank lines / trailing whitespace to exercise trimming).
 *
 * @returns {fc.Arbitrary<string>}
 */
export function learnerContentArb() {
  return fc
    .array(lineArb, { minLength: 1, maxLength: 12 })
    .chain((lines) =>
      // Optionally sprinkle blank lines and surrounding whitespace so the
      // importer's trimming/discard-empty logic (Property 2) is exercised.
      fc.constantFrom("\n", "\n\n", " \n", "\n \n").map((joiner) => {
        const body = lines.join(joiner);
        return body;
      })
    );
}

/**
 * Edge-input generator: the degenerate corners the properties must handle.
 *   - empty / whitespace-only strings (Requirement 3.1),
 *   - single-sentence inputs (Property 7 "too_few", Property 11 single-line),
 *   - over-5,000-character strings (Property 4),
 *   - non-Latin-only strings (not-French path, Requirement 3.3).
 *
 * @returns {fc.Arbitrary<string>}
 */
export function edgeInputArb() {
  return fc.oneof(
    // empty / whitespace-only
    fc.constantFrom("", " ", "   ", "\n", "\t\n  ", "\n\n\n"),
    // single sentence (yields < 2 Source_Lines)
    sentenceArb,
    // over 5,000 characters: repeat sentences until well past the cap
    fc
      .array(sentenceArb, { minLength: 120, maxLength: 200 })
      .map((arr) => {
        let s = arr.join(" ");
        while (s.length <= 5000) s += " " + arr.join(" ");
        return s;
      }),
    // non-Latin only
    fc
      .array(fc.constantFrom(...NON_LATIN), { minLength: 1, maxLength: 6 })
      .map((arr) => arr.join(" . "))
  );
}

/**
 * Matcher-response generator: objects with in-set and out-of-set `verdict`
 * values and injected French strings in `note` / `suggest` / `structure`, to
 * exercise Property 13 (verdict mapping + French discard). Provided here so the
 * Say-it adapter tests (Task 7.2) can reuse the harness.
 *
 * @returns {fc.Arbitrary<object>}
 */
export function matcherResponseArb() {
  const knownVerdicts = ["works", "thin", "missed", "unchecked"];
  const verdictArb = fc.oneof(
    fc.constantFrom(...knownVerdicts),
    // out-of-set values that must coerce to "not checked"
    fc.constantFrom("brilliant", "wrong", "", "WORKS", "ok", "near", "off")
  );
  // Injected French the adapter must discard — drawn from the French-ish pool.
  const injectedFrench = fc.constantFrom(...FRENCH_CLAUSES);
  return fc.record({
    verdict: verdictArb,
    index: fc.integer({ min: -3, max: 10 }),
    note: fc.oneof(fc.string(), injectedFrench),
    suggest: fc.array(injectedFrench, { maxLength: 4 }),
    structure: fc.oneof(fc.string(), injectedFrench),
  });
}

export { fc };
