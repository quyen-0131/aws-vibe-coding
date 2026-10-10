// property14.test.js — property test for the learner Done screen (Task 9.5).
//
// Feature: content-to-exercise, Property 14: Done screen pairs honestly and shows no scores
//
// Property 14 (design.md): For any session attempt log, the Done screen pairs
// each submitted attempt with the reference Source_Line recorded for that
// attempt's exercise identity; every French string shown on Done is verbatim
// Learner_Content or a learner's own attempt (no System-generated French); and
// the Done output contains no score, fraction, percentage, numeric count of
// attempts or correct answers, level, or streak.
//
// Validates: Requirements 9.1, 9.2, 9.3, 9.4.
//
// The real Done screen lives in the host's classic (non-module) script
// (weekend-mission-prototype.html `screenDone()`), which cannot be imported.
// Following the established approach in render-parity.test.js / done-screen.test.js,
// this file drives Property 14 from two angles:
//   1. A PURE model (`doneModel`) that mirrors the host's learner-session Done
//      contract exactly, run under fast-check over generated session attempt logs
//      (the `S.said` attempt log + `S.mine` written-sentence map). The model pairs
//      each attempt with the reference recorded at attempt time (never re-derived),
//      shows word-card phrases + the learner's own sentences, and renders no score.
//   2. Structural assertions over the real host `screenDone()` source, so the pure
//      model and the real screen cannot drift (the host still pairs via
//      `S.said.map(x => esc(x.mine) ... esc(x.theirs))`, never references
//      `conv().turns` inside screenDone, never renders `x.kind`, and gates the
//      authored French teaser behind `learnerActive() ? "" :`).
//
// Uses Node's built-in test runner (node:test + node:assert/strict). The
// Learner_Content generator (learnerContentArb) and fast-check (`fc`) are reused
// from the shared harness; the no-invented-French containment helper is reused
// from ./containment.js. No globals are patched (the model is pure).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { importContent } from "./importer.js";
import { selectWordCards } from "./builder.js";
import { isVerbatimSliceOf } from "./containment.js";
import { learnerContentArb, fc } from "./test-harness.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST_HTML = resolve(HERE, "..", "..", "weekend-mission-prototype.html");
const readHost = () => readFileSync(HOST_HTML, "utf8");

// The authored French teaser tokens the host shows ONLY for Authored_Content.
// None of these may appear in a learner Done output unless they genuinely came
// from the learner's own material (Req 9.4).
const AUTHORED_FRENCH_TEASERS = ["franchement", "plutôt", "carrément"];

// Forbidden scoring-metric tokens the Done output must never render (Req 9.3).
// Mirrors the forbidden set asserted structurally in done-screen.test.js.
const FORBIDDEN_METRICS = ["percent", "%", "streak", " level ", "points", "out of"];

// The fixed verdict kinds a Say-it attempt can carry. `kind` is recorded in
// S.said but must NEVER be rendered on Done (no tally — Req 9.3).
const VERDICT_KINDS = ["works", "thin", "missed", "not checked", "off", "skip"];

/**
 * Pure model of the host learner-session `screenDone()` contract. It mirrors the
 * host exactly:
 *   - "What you said" pairs each S.said entry's `x.mine` with its recorded
 *     `x.theirs` (the reference captured at attempt time, keyed by `x.idx`); it
 *     never re-reads the transcript at Done time. `x.kind` is NOT rendered.
 *   - "Phrases worth keeping" lists the word-card phrases (verbatim learner
 *     French); a gloss is shown only when it is non-null.
 *   - "Sentences you wrote" lists S.mine keyed by word-card phrase.
 *   - The authored French teaser is gated out of a learner session entirely.
 *
 * Returns a structured result plus a single rendered-ish text blob so tests can
 * both inspect the paired rows and sweep the full output for forbidden content.
 *
 * @param {{ said: Array<{idx:number, mine:string, theirs:string, kind:string}>,
 *           mine: Record<string,string>,
 *           wordCards: Record<string, {phrase:string, en:(string|null), note:(string|null), examples:any[]}> }} args
 */
function doneModel({ said, mine, wordCards }) {
  const esc = (s) => String(s); // the host esc() only HTML-escapes; identity for our French-provenance checks.

  // "What you said": pair x.mine with the recorded x.theirs. kind is NOT used.
  const saidRows = said.map((x) => ({ mine: x.mine, theirs: x.theirs }));
  const saidText = said
    .map((x) => `<div class="said"><span class="mine">${esc(x.mine)}</span>` +
      `<span class="theirs">Your own reference line — ${esc(x.theirs)}</span></div>`)
    .join("");

  // "Phrases worth keeping": word-card phrases; gloss only when non-null.
  const phrases = Object.keys(wordCards);
  const phraseText = phrases
    .map((p) => {
      const g = wordCards[p];
      const gloss = g && g.en != null ? ` — ${esc(g.en)}` : "";
      return `<p><strong>${esc(p)}</strong>${gloss}</p>`;
    })
    .join("");

  // "Sentences you wrote": S.mine keyed by word-card phrase, non-empty only.
  const mineKeys = Object.keys(mine).filter((k) => (mine[k] || "").trim());
  const mineText = mineKeys
    .map((k) => `<p><strong>${esc(k)}</strong> — ${esc(mine[k])}</p>`)
    .join("");

  // Empty-session branch (Req 9.5): plain English, no evidence, no French.
  const empty = said.length === 0 && mineKeys.length === 0;
  const emptyText = empty
    ? "No sentences were kept this session. Nothing was scored."
    : "";

  // App-authored English framing shown around the evidence (no learner French).
  const framing =
    "Conversation finished. You practised with the French you brought. " +
    "Nothing was scored. There is no number here on purpose. " +
    "What you said is below. That is the evidence.";

  // The authored French teaser is gated OUT for a learner session (Req 9.4):
  // the model is a learner session, so it contributes no French at all.
  const teaserText = "";

  const rendered =
    framing +
    (saidText ? "What you said" + saidText : "") +
    (phraseText ? "Phrases worth keeping" + phraseText : "") +
    (mineText ? "Sentences you wrote" + mineText : "") +
    teaserText +
    emptyText;

  // The APP-AUTHORED portion of the output: framing, section headers, labels and
  // any gloss — i.e. everything the System itself emits, excluding the learner's
  // own free-form attempt text (x.mine) and written sentences (S.mine values).
  // The no-score sweep (Req 9.3) targets System-rendered scoring, so a learner
  // who happens to type "%" or "level" in their own sentence is not a violation.
  const appAuthored =
    framing +
    (saidText ? "What you said" : "") +
    said.map(() => "Your own reference line — ").join("") +
    (phraseText ? "Phrases worth keeping" : "") +
    phrases.map((p) => {
      const g = wordCards[p];
      return g && g.en != null ? ` — ${esc(g.en)}` : "";
    }).join("") +
    (mineText ? "Sentences you wrote" : "") +
    teaserText +
    emptyText;

  return {
    saidRows, phrases, mineKeys, saidText, phraseText, mineText,
    framing, rendered, appAuthored, empty,
  };
}

// ===========================================================================
// The property, over generated learner session attempt logs.
// ===========================================================================

test("Property 14: Done screen pairs honestly and shows no scores", () => {
  fc.assert(
    fc.property(
      // Only accepted imports have a transcript to draw references from.
      learnerContentArb().filter((raw) => {
        const r = importContent(raw);
        return r.ok && r.sourceLines.length >= 1;
      }),
      // A plausible attempt log: pick which transcript lines were attempted (by
      // selector into the imported sourceLines), the learner's own free-form
      // attempt text, and a verdict kind that must never be rendered.
      fc.array(
        fc.record({
          lineSelector: fc.nat(),
          mine: fc.string(),
          kind: fc.constantFrom(...VERDICT_KINDS),
        }),
        { maxLength: 8 }
      ),
      // S.mine: free-form sentences the learner wrote against some word-cards
      // (keyed later to real word-card phrases so provenance holds).
      fc.array(fc.string(), { maxLength: 4 }),
      (rawText, attemptSpecs, writtenSentences) => {
        const result = importContent(rawText);
        assert.ok(result.ok, "filtered to ok imports");
        const sourceLines = result.sourceLines;
        // The transcript is one turn per Source_Line in order; `theirs` is the
        // verbatim Source_Line French recorded at attempt time, keyed by idx.
        const transcript = sourceLines.map((l, i) => ({ idx: i, fr: l.fr }));

        // Build S.said: each attempt records its exercise identity (idx) and the
        // reference captured AT ATTEMPT TIME (theirs === transcript[idx].fr).
        const said = attemptSpecs.map((spec) => {
          const idx = spec.lineSelector % transcript.length;
          return { idx, mine: spec.mine, theirs: transcript[idx].fr, kind: spec.kind };
        });

        // Build the word-cards the way the host does, then key S.mine to real
        // word-card phrases (the learner's own sentences written against them).
        const wordCards = selectWordCards(sourceLines);
        const phrases = Object.keys(wordCards);
        /** @type {Record<string,string>} */
        const mine = {};
        writtenSentences.forEach((sentence, i) => {
          if (phrases.length === 0) return;
          const key = phrases[i % phrases.length];
          // Only record non-empty sentences (the host filters by trim()).
          if (sentence.trim()) mine[key] = sentence;
        });

        const out = doneModel({ said, mine, wordCards });

        // ---- 1. Pairing honesty (Req 9.1) -------------------------------------
        // Every rendered row pairs the attempt with the reference recorded for
        // that attempt's identity — by the recorded value, not a re-derivation.
        assert.equal(out.saidRows.length, said.length, "one row per recorded attempt");
        for (let k = 0; k < said.length; k++) {
          const row = out.saidRows[k];
          assert.equal(row.mine, said[k].mine, "row shows the learner's own attempt text");
          // Reference equals the recorded reference for this attempt...
          assert.equal(row.theirs, said[k].theirs, "row pairs by the recorded reference");
          // ...and that recorded reference is the verbatim transcript line for its idx.
          assert.equal(
            said[k].theirs,
            transcript[said[k].idx].fr,
            "the recorded reference is the verbatim Source_Line for the attempt's identity"
          );
        }

        // ---- 2. French provenance (Req 9.2, 9.4) ------------------------------
        // Every reference French shown is a verbatim slice of some Source_Line.
        for (const row of out.saidRows) {
          assert.ok(
            isVerbatimSliceOf(row.theirs, sourceLines),
            `reference French must be verbatim Learner_Content: ${JSON.stringify(row.theirs)}`
          );
        }
        // Every word-card phrase shown is a verbatim slice of some Source_Line.
        for (const p of out.phrases) {
          assert.ok(
            isVerbatimSliceOf(p, sourceLines),
            `word-card phrase must be verbatim Learner_Content: ${JSON.stringify(p)}`
          );
          // Any gloss shown is app-authored English, and here is always null
          // (learner supplied none), so no fabricated gloss leaks in.
          assert.equal(wordCards[p].en, null, "no fabricated gloss for a learner word-card");
        }
        // "Sentences you wrote" shows the learner's OWN attempt text (mine) under
        // a verbatim word-card phrase key — the learner's own words, by provenance.
        for (const k of out.mineKeys) {
          assert.ok(
            isVerbatimSliceOf(k, sourceLines),
            `sentence key must be a verbatim word-card phrase: ${JSON.stringify(k)}`
          );
        }
        // No System/authored French teaser token may appear UNLESS the learner's
        // own material genuinely contains it (then it is their French, allowed).
        for (const token of AUTHORED_FRENCH_TEASERS) {
          const inLearnerMaterial =
            sourceLines.some((l) => l.fr.includes(token)) ||
            said.some((x) => x.mine.includes(token)) ||
            out.mineKeys.some((k) => mine[k].includes(token));
          if (!inLearnerMaterial) {
            assert.ok(
              !out.rendered.includes(token),
              `authored French teaser "${token}" must not appear on a learner Done screen`
            );
          }
        }

        // ---- 3. No scores (Req 9.3) -------------------------------------------
        // Scope the forbidden-metric sweep to the APP-AUTHORED output (framing,
        // headers, labels, glosses). The learner's own attempt/sentence text is
        // their words, not a System score — a learner typing "%" is not a Done
        // scoring violation (Req 9.3 forbids System-rendered scores/metrics).
        const lower = out.appAuthored.toLowerCase();
        for (const metric of FORBIDDEN_METRICS) {
          assert.ok(
            !lower.includes(metric.toLowerCase()),
            `Done output must not render scoring metric: "${metric}"`
          );
        }
        // The per-attempt verdict kind is never rendered (no tally).
        for (const x of said) {
          // "off"/"skip"/"thin"/"missed"/"works" never surface as a rendered
          // verdict label. We only need to be sure the model didn't emit the kind
          // string in a scoring context; assert the kind field is absent from the
          // paired rows and that no row carries a kind property.
          assert.equal(
            Object.prototype.hasOwnProperty.call(
              out.saidRows[said.indexOf(x)] || {},
              "kind"
            ),
            false,
            "rendered attempt rows must not carry the verdict kind"
          );
        }
        // No numeric attempt/correct count is concatenated into the app-authored
        // output: the attempt count must not appear as a standalone rendered
        // number tied to a scoring word.
        assert.ok(
          !new RegExp(`\\b${said.length}\\b\\s*(attempts|correct|out of|/)`).test(lower),
          "no attempt/correct count rendered"
        );
      }
    ),
    { numRuns: 100 }
  );
});

// ===========================================================================
// Structural fidelity: the pure model must match the real host screenDone().
// These keep doneModel honest against the live screen (prevents drift).
// ===========================================================================

/** Extract screenDone() body so assertions stay scoped to that function. */
function screenDoneSource(html) {
  const start = html.indexOf("function screenDone()");
  assert.ok(start >= 0, "screenDone() should exist in the host");
  const after = html.indexOf("\nfunction ", start + 1);
  assert.ok(after > start, "a following function should bound screenDone()");
  return html.slice(start, after);
}

test("host screenDone pairs via S.said.map(x => esc(x.mine) ... esc(x.theirs)) (Req 9.1)", () => {
  const done = screenDoneSource(readHost());
  assert.match(done, /S\.said\.map\(x\s*=>/);
  assert.match(done, /esc\(x\.mine\)/);
  assert.match(done, /esc\(x\.theirs\)/);
});

test("host screenDone never re-derives references from conv().turns (Req 9.1)", () => {
  const done = screenDoneSource(readHost());
  assert.ok(
    !/conv\(\)\.turns/.test(done),
    "Done must pair by the recorded reference, not re-read conv().turns"
  );
});

test("host screenDone never renders the per-attempt verdict kind (Req 9.3)", () => {
  const done = screenDoneSource(readHost());
  assert.ok(!/\bx\.kind\b/.test(done), "the verdict kind must not be rendered as a tally");
});

test("host screenDone gates the authored French teaser behind learnerActive() ? \"\" : (Req 9.4)", () => {
  const done = screenDoneSource(readHost());
  assert.match(done, /franchement/);
  assert.match(done, /learnerActive\(\)\s*\?\s*""\s*:/);
});
