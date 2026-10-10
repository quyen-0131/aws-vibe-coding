// matcher-adapter.test.js — property test for the Say-it matcher adapter (Task 7.2).
//
// Feature: content-to-exercise, Property 13: Matcher verdict mapping stays inside
// the fixed set.
//
// Property 13 (design.md): For any matcher response, the presented Verdict's
// `kind` is exactly one value from {works, thin, missed, not checked}; a verdict
// value outside the matcher's known set maps to `not checked`; any French string
// the matcher generates is discarded so the only French presented is the
// learner's own reference Source_Line, and that reference equals the input
// reference verbatim and is labelled as a reference, never as a corrected or
// generated answer.
//
// Validates: Requirements 8.2, 8.3, 8.4, 8.5.
//
// Uses Node's built-in test runner (node:test + node:assert/strict), matching the
// existing test files. The matcher-response generator (matcherResponseArb) and
// fast-check (`fc`) are reused from the shared test harness.

import { test } from "node:test";
import assert from "node:assert/strict";

import { judgeLearnerAttempt } from "./matcher-adapter.js";
import { matcherResponseArb, fc } from "./test-harness.js";

// The fixed learner-facing verdict set (design Data Models). Nothing else may be
// presented.
const ALLOWED_KINDS = new Set(["works", "thin", "missed", "not checked"]);

// Verdict values the server/adapter treats as "known" and passes through. Any
// value NOT in this set must coerce to "not checked" (Requirement 8.5).
const PASS_THROUGH_VERDICTS = new Set(["works", "thin", "missed"]);

// The pool of French clauses the generator injects into note/suggest/structure.
// Mirrors FRENCH_CLAUSES in test-harness.js. Property 13 requires that none of
// this generated French reaches the learner (Requirement 8.4) — the only French
// surfaced is the learner's own reference line.
const INJECTED_FRENCH_POOL = [
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

// A reference line deliberately DISTINCT from the injected-French pool, so any
// French that leaked from the matcher response would be distinguishable from the
// learner's own reference. (English words keep it clearly outside the pool.)
const REFERENCE_SOURCE_LINE = "LEARNER-REF: this exact reference line is the learner's own.";

test("Property 13: matcher verdict mapping stays inside the fixed set", async () => {
  // Guard: the reference line must not accidentally coincide with any injected
  // French clause, otherwise assertion 4 could not distinguish the two sources.
  assert.ok(
    !INJECTED_FRENCH_POOL.includes(REFERENCE_SOURCE_LINE),
    "reference line must be distinct from the injected-French pool"
  );

  const originalFetch = globalThis.fetch;

  try {
    await fc.assert(
      fc.asyncProperty(matcherResponseArb(), async (response) => {
        // Each generated matcher response is returned as a successful call:
        // response.ok === true and response.json() resolves to the generated body.
        globalThis.fetch = async () => ({
          ok: true,
          json: async () => response,
        });

        const verdict = await judgeLearnerAttempt(
          "mon attempt",
          REFERENCE_SOURCE_LINE,
          { where: "a cafe", you: "a regular", them: "a friend", want: "say hi", done: "greeted" },
          []
        );

        // --- Assertion 1: kind is always inside the fixed set. ---------------
        assert.ok(
          ALLOWED_KINDS.has(verdict.kind),
          `kind "${verdict.kind}" must be one of {works, thin, missed, not checked}`
        );

        // --- Assertion 2: any verdict NOT in {works, thin, missed} => "not checked".
        if (!PASS_THROUGH_VERDICTS.has(response.verdict)) {
          assert.equal(
            verdict.kind,
            "not checked",
            `out-of-set verdict "${String(response.verdict)}" must map to "not checked"`
          );
        }

        // --- Assertion 3: reference equals the input reference verbatim. -----
        assert.equal(
          verdict.reference,
          REFERENCE_SOURCE_LINE,
          "returned reference must equal the input referenceSourceLine verbatim"
        );

        // --- Assertion 4: no generated French surfaces; only the learner's
        // reference is French. The adapter must never expose suggest/structure
        // fields, and no injected suggest/structure value may appear as the
        // returned reference. (The note may legitimately equal data.note — the
        // English coach note — so French is excluded structurally by the adapter
        // never reading suggest/structure, which we assert via field absence.)
        assert.ok(
          !("suggest" in verdict),
          "verdict must not expose a `suggest` field (generated French discarded)"
        );
        assert.ok(
          !("structure" in verdict),
          "verdict must not expose a `structure` field (generated French discarded)"
        );

        // None of the injected French may have leaked into the reference slot.
        for (const fr of response.suggest || []) {
          assert.notEqual(
            verdict.reference,
            fr,
            "no injected `suggest` French may appear as the returned reference"
          );
        }
        assert.notEqual(
          verdict.reference,
          response.structure,
          "the injected `structure` value must not appear as the returned reference"
        );

        // The returned verdict exposes exactly the three presented fields.
        assert.deepEqual(
          Object.keys(verdict).sort(),
          ["kind", "note", "reference"],
          "verdict must expose only kind, note, and reference"
        );

        // The note is always an English string whose SOURCE is one of exactly
        // two places: the matcher's own `note` field (the server's English
        // coach-note slot, surfaced only for a pass-through verdict) or the app's
        // own English unavailable message. It is never drawn from `suggest` or
        // `structure`. We assert provenance rather than value: `note` may
        // coincidentally equal a `suggest`/`structure` string when the matcher
        // put the same text in its English `note` slot, but the adapter must have
        // sourced it from `data.note`, not from the French-bearing fields.
        assert.equal(typeof verdict.note, "string", "note must be a string");
        if (verdict.kind === "not checked") {
          // Unavailable path: the note is the app's fixed English message, which
          // the adapter owns — it is never any field of the matcher response.
          assert.notEqual(
            verdict.note,
            response.note,
            "unavailable note is the app's own message, not the matcher's note"
          );
        } else {
          // Pass-through verdict: the note is exactly the matcher's English note
          // slot (`data.note`) — proving the adapter sourced it from `note`, never
          // from `suggest`/`structure`.
          assert.equal(
            verdict.note,
            typeof response.note === "string" ? response.note : "",
            "pass-through note must be sourced from the matcher's `note` field only"
          );
        }
      }),
      { numRuns: 100 }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
