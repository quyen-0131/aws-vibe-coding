// containment.test.js — unit + property tests for the containment helper and
// the fast-check harness set up in Task 1.
//
// These tests verify the two load-bearing pieces Task 1 delivers:
//   1. `isVerbatimSliceOf` — the no-invented-French master check backing
//      Property 1. It must accept only exact, verbatim substrings (accents,
//      casing, contractions preserved) and reject anything altered.
//   2. The fast-check harness + generators run (a minimum of 100 iterations)
//      and produce usable inputs for later property tests.
//
// Uses Node's built-in test runner (node:test) + fast-check, matching the
// project's test setup.

import { test } from "node:test";
import assert from "node:assert/strict";

import fc from "fast-check";

import { isVerbatimSliceOf } from "./containment.js";
import { learnerContentArb, edgeInputArb, matcherResponseArb } from "./test-harness.js";

/** Build minimal SourceLine-ish objects from fr strings (only `fr` is read). */
const linesFrom = (...frs) =>
  frs.map((fr, index) => ({ speaker: null, fr, en: "", provenance: "learner", index }));

// ---------------------------------------------------------------------------
// Unit tests — isVerbatimSliceOf
// ---------------------------------------------------------------------------

test("isVerbatimSliceOf: accepts an exact substring with accents preserved", () => {
  const lines = linesFrom("Salut ! T'as passé un bon week-end ?");
  assert.equal(isVerbatimSliceOf("passé un bon", lines), true);
  assert.equal(isVerbatimSliceOf("T'as", lines), true);
  assert.equal(isVerbatimSliceOf("Salut ! T'as passé un bon week-end ?", lines), true);
});

test("isVerbatimSliceOf: rejects accent/case/contraction alterations", () => {
  const lines = linesFrom("Salut ! T'as passé un bon week-end ?");
  // accent stripped
  assert.equal(isVerbatimSliceOf("passe un bon", lines), false);
  // case changed
  assert.equal(isVerbatimSliceOf("salut !", lines), false);
  // contraction expanded ("t'as" -> "tu as")
  assert.equal(isVerbatimSliceOf("tu as", lines), false);
  // added character
  assert.equal(isVerbatimSliceOf("passé un  bon", lines), false);
});

test("isVerbatimSliceOf: checks across all source lines", () => {
  const lines = linesFrom("Première phrase.", "Deuxième phrase ô là là.");
  assert.equal(isVerbatimSliceOf("ô là là", lines), true);
  assert.equal(isVerbatimSliceOf("Première", lines), true);
  assert.equal(isVerbatimSliceOf("troisième", lines), false);
});

test("isVerbatimSliceOf: defensive against bad arguments", () => {
  assert.equal(isVerbatimSliceOf("x", null), false);
  assert.equal(isVerbatimSliceOf(42, linesFrom("abc")), false);
  assert.equal(isVerbatimSliceOf("x", [null, undefined, {}]), false);
});

// ---------------------------------------------------------------------------
// Property — any substring of a source line is a verbatim slice of it.
// (A sanity property for the helper itself, run at >= 100 iterations.)
// ---------------------------------------------------------------------------

test("property: every substring of a source line is reported as a verbatim slice", () => {
  fc.assert(
    fc.property(
      learnerContentArb(),
      fc.nat(),
      fc.nat(),
      (content, startSeed, lenSeed) => {
        const lines = linesFrom(content);
        const fr = lines[0].fr;
        if (fr.length === 0) return; // nothing to slice
        const start = startSeed % fr.length;
        const len = lenSeed % (fr.length - start + 1);
        const slice = fr.slice(start, start + len);
        // A real, verbatim slice must be reported true.
        assert.equal(isVerbatimSliceOf(slice, lines), true);
      }
    ),
    { numRuns: 200 }
  );
});

// ---------------------------------------------------------------------------
// Harness smoke tests — generators produce usable inputs.
// ---------------------------------------------------------------------------

test("harness: learnerContentArb produces non-null strings over 100+ runs", () => {
  let seen = 0;
  fc.assert(
    fc.property(learnerContentArb(), (content) => {
      seen += 1;
      assert.equal(typeof content, "string");
    }),
    { numRuns: 150 }
  );
  assert.ok(seen >= 100, `expected >= 100 generated cases, saw ${seen}`);
});

test("harness: edgeInputArb covers empty, single, over-cap, and non-Latin shapes", () => {
  let sawEmpty = false;
  let sawOverCap = false;
  fc.assert(
    fc.property(edgeInputArb(), (s) => {
      assert.equal(typeof s, "string");
      if (s.trim().length === 0) sawEmpty = true;
      if (s.length > 5000) sawOverCap = true;
    }),
    { numRuns: 300 }
  );
  // Over many runs we expect to have hit both corners at least once.
  assert.ok(sawEmpty, "expected to generate at least one empty/whitespace input");
  assert.ok(sawOverCap, "expected to generate at least one over-5,000-char input");
});

test("harness: matcherResponseArb produces objects with a verdict field", () => {
  fc.assert(
    fc.property(matcherResponseArb(), (resp) => {
      assert.equal(typeof resp, "object");
      assert.ok("verdict" in resp);
    }),
    { numRuns: 100 }
  );
});
