// types.js — shared JSDoc typedefs for content-to-exercise.
//
// These typedefs pin down the data shapes described in the design "Data Models"
// section. They are documentation + editor type-checking only; at runtime this
// module exports nothing but the typedefs (JS has no runtime types).
//
// The guiding constraint behind every French-bearing field here is the
// no-invented-French invariant (Requirement 10, design Property 1): any `fr`
// string is a verbatim slice of learner-supplied content; English fields
// (`en`, `note`, Scene parts, coach notes) are app-authored and clearly labelled
// as the app's, never passed off as the learner's French.

/**
 * A single French sentence/utterance extracted from Learner_Content.
 *
 * @typedef {Object} SourceLine
 * @property {string|null} speaker  Speaker label (1..20 chars) or `null` when the
 *   line is unattributed. Never an empty string.
 * @property {string} fr  Verbatim learner French, outer-trimmed only. Accents and
 *   casual-French contractions are preserved exactly; internal characters are
 *   never altered.
 * @property {string} en  Learner-supplied English for this line, else `""`. Never
 *   an invented translation.
 * @property {"learner"} provenance  Always `"learner"` for imported content.
 * @property {number} index  0-based position within the Learner_Content.
 */

/**
 * A Read-step turn, matching the prototype `WEEKENDS[key].turns` shape
 * `[speaker, fr, en]`.
 *
 * @typedef {[speaker: string, fr: string, en: string]} Turn
 */

/**
 * A tappable word-card, matching (and extending) the prototype `PHRASES` shape.
 * The `phrase` is a verbatim slice of a Source_Line; `en`/`note` are app-authored
 * English (or `null` when the learner supplied no gloss); `examples` are drawn
 * verbatim from Source_Lines and labelled with their origin.
 *
 * @typedef {Object} WordCard
 * @property {string} phrase  Verbatim slice of a Source_Line's `fr`.
 * @property {string|null} en  App-authored English gloss, or `null` when none.
 * @property {string|null} note  App-authored English note, or `null` when none.
 * @property {Array<{ fr: string, en: string, src: string }>} examples  1..3
 *   examples; `fr` verbatim from a Source_Line; `src` = speaker + position label.
 */

/**
 * A map from phrase string to its WordCard, matching the prototype `PHRASES`
 * keyed-by-phrase shape.
 *
 * @typedef {Object.<string, WordCard>} WordCardMap
 */

/**
 * The five-part Scene framing, matching the prototype `SCENE` shape. All values
 * are app-authored English — never copied or translated Learner_Content French.
 *
 * @typedef {Object} Scene
 * @property {string} where
 * @property {string} you
 * @property {string} them
 * @property {string} want
 * @property {string} done
 */

/**
 * A Build-step chip pool. `target` is the ordered target chunks for the selected
 * Source_Line; `pool` is the shuffled chips the learner picks from, with
 * `pool.length <= target.length + 4`.
 *
 * @typedef {Object} Pool
 * @property {string[]} target  Ordered target chunk strings (verbatim slices).
 * @property {string[]} pool  Target chunks plus 0..4 decoy chunks (verbatim slices).
 */

/**
 * The Say-it matcher result. `kind` is always one of the fixed set; `note` is
 * English coach feedback; `reference` is the learner's own Source_Line, labelled
 * as a reference (never a corrected or generated answer).
 *
 * @typedef {Object} Verdict
 * @property {"works"|"thin"|"missed"|"not checked"} kind
 * @property {string} note  English coach note.
 * @property {string} reference  The learner's own reference Source_Line (verbatim).
 */

/**
 * Result of importing raw learner text.
 *
 * @typedef {Object} ImportOk
 * @property {true} ok
 * @property {SourceLine[]} sourceLines
 * @property {boolean} truncated  True when input exceeded the 5,000-char cap.
 *
 * @typedef {Object} ImportError
 * @property {false} ok
 * @property {"empty"|"too_few"|"not_french"} reason
 * @property {string} message  Plain-English, learner-facing.
 * @property {number} sourceLineCount  Source_Lines found (for "too_few").
 * @property {string} preservedText  The learner's text, echoed back verbatim.
 * @property {boolean} [requiresConfirmation]  True only for "not_french".
 *
 * @typedef {ImportOk | ImportError} ImportResult
 */

/**
 * The aggregated builder output: the four existing shapes the Read/Build/Say-it/
 * Done screens already consume.
 *
 * @typedef {Object} BuiltSession
 * @property {Turn[]} transcript
 * @property {WordCardMap} wordCards
 * @property {Scene} scene
 * @property {(index: number) => Pool} buildFor
 * @property {string[]} degradedReasons  Plain-English reason(s) for any build
 *   step that fell back to its defined degraded form (Requirement 10.5); empty
 *   when no step degraded.
 */

// This module intentionally exports no runtime values — it is types only.
export {};
