// containment.js — the shared no-invented-French containment helper.
//
// This is the machine-checkable heart of the feature's hard constraint
// (Requirement 10, design Property 1): the app never invents French. Every
// French string any transform emits must be an EXACT character-for-character
// substring of some Source_Line's `fr` — accents, casing, and casual-French
// contractions preserved, with nothing added, removed, substituted, or
// corrected.
//
// `isVerbatimSliceOf` is deliberately strict: it uses native `String#includes`,
// which is a byte-for-byte (code-unit) substring test. It performs NO
// normalization — no case folding, no accent stripping, no Unicode NFC/NFD
// folding, no trimming of the needle. That strictness is the point: if a
// transform ever changes a single character, this returns false and the
// property test fails.
//
// It is reused as the assertion backing the builder transforms (buildTranscript,
// selectWordCards, chunksOf, buildPool) and as the master assertion helper in
// the Property 1 test over a full BuiltSession.

/**
 * @typedef {import("./types.js").SourceLine} SourceLine
 */

/**
 * Returns true only when `frString` is an exact character-for-character
 * substring of some Source_Line's `fr`.
 *
 * Notes on the contract:
 * - The empty string is a substring of every string. Transforms must therefore
 *   never emit an empty French string and rely on this to "pass"; emptiness is
 *   guarded separately where it matters (e.g. Source_Lines are non-empty by
 *   Property 2). This helper only answers the containment question.
 * - Comparison is strict and verbatim: no case/accent/whitespace normalization.
 *
 * @param {string} frString  The candidate French string to check.
 * @param {SourceLine[]} sourceLines  The learner's Source_Lines (the only
 *   permitted source of French).
 * @returns {boolean} true iff `frString` is a verbatim substring of some
 *   `sourceLines[i].fr`.
 */
export function isVerbatimSliceOf(frString, sourceLines) {
  if (typeof frString !== "string") return false;
  if (!Array.isArray(sourceLines)) return false;

  for (const line of sourceLines) {
    if (line && typeof line.fr === "string" && line.fr.includes(frString)) {
      return true;
    }
  }
  return false;
}
