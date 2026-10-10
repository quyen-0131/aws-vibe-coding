// done-screen.test.js — example/integration tests for the Done screen built
// from learner content (Task 9.3).
//
// Task 9.3 completes the Done screen for a learner-built session. The screen is
// evidence, never a score. The behaviors under test (and the acceptance criteria
// they anchor to):
//   - Req 9.1: each submitted attempt is paired with the reference Source_Line
//     recorded for that attempt's exercise identity, matched by the identity used
//     at attempt time (so pairing is by the recorded reference, not re-derived).
//   - Req 9.2: the tapped/saved Word_Card phrases AND the learner's own attempt
//     sentences are shown, all French drawn verbatim from Learner_Content / the
//     learner's own attempts.
//   - Req 9.3: no score, fraction, percentage, numeric count of attempts/correct
//     answers, level, or streak appears on the Done screen.
//   - Req 9.4: every French string shown is verbatim Learner_Content or the
//     learner's own attempt — no System-generated French (the authored
//     "franchement / plutôt / carrément" teaser is Authored-only).
//   - Req 9.5: an empty session (no attempts and no written sentences) shows a
//     plain-English "no sentences were kept this session" message, not an empty
//     screen or fabricated evidence.
//
// The screen/render logic lives in the host's classic (non-module) script, which
// cannot be imported here, so — matching render-parity.test.js — these tests
// drive Task 9.3 structurally against the host HTML source, asserting the exact
// pairing/empty-session/no-score/no-System-French guarantees the Done screen now
// makes.
//
// Uses Node's built-in test runner (node:test), matching the project setup.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST_HTML = resolve(HERE, "..", "..", "weekend-mission-prototype.html");
const readHost = () => readFileSync(HOST_HTML, "utf8");

/** Extract the body of screenDone() so assertions stay scoped to that function. */
function screenDoneSource(html) {
  const start = html.indexOf("function screenDone()");
  assert.ok(start >= 0, "screenDone() should exist in the host");
  // The next top-level `function ` after screenDone marks the end.
  const after = html.indexOf("\nfunction ", start + 1);
  assert.ok(after > start, "a following function should bound screenDone()");
  return html.slice(start, after);
}

/** screenDone() source with // line- and block-comments stripped, so the
 *  rendered-output checks (Req 9.3) don't trip over explanatory prose. */
function screenDoneRendered(html) {
  return screenDoneSource(html)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

// ===========================================================================
// Req 9.1 — attempts are recorded WITH their exercise identity and reference
// ===========================================================================

test("each submitted attempt records its exercise identity and reference line (Req 9.1)", () => {
  const html = readHost();
  // The Say-it "next line" handler pushes an attempt entry carrying the exercise
  // identity (turn index `at`), the learner's own attempt (`mine`), and the
  // reference Source_Line captured at attempt time (`theirs`).
  assert.match(html, /S\.said\.push\(\{\s*idx:\s*at,/);
  assert.match(html, /theirs:\s*conv\(\)\.turns\[at\]\[1\]/);
});

test("the Done screen pairs attempts by the recorded reference, not a re-derivation (Req 9.1)", () => {
  const done = screenDoneSource(readHost());
  // "What you said" is built from S.said, pairing x.mine (the attempt) with
  // x.theirs (the reference recorded for that attempt's identity) — never by
  // re-reading conv().turns at Done time.
  assert.match(done, /S\.said\.map\(x\s*=>/);
  assert.match(done, /esc\(x\.mine\)/);
  assert.match(done, /esc\(x\.theirs\)/);
  assert.ok(
    !/conv\(\)\.turns/.test(done),
    "Done must not re-derive references from conv().turns"
  );
});

// ===========================================================================
// Req 9.2 — tapped/saved phrases AND the learner's own attempt sentences
// ===========================================================================

test("the Done screen shows kept Word_Card phrases and the learner's own sentences (Req 9.2)", () => {
  const done = screenDoneSource(readHost());
  // Word-card phrases worth keeping come from the source-neutral accessor.
  assert.match(done, /phrasesIn\(S\.key\)/);
  assert.match(done, /Phrases worth keeping/);
  // The learner's own attempt sentences are shown ("What you said").
  assert.match(done, /What you said/);
  // Sentences the learner wrote against a word-card are shown too.
  assert.match(done, /Sentences you wrote/);
  assert.match(done, /S\.mine\[k\]/);
});

// ===========================================================================
// Req 9.3 — no score / fraction / percentage / count / level / streak
// ===========================================================================

test("the Done screen renders no score, count, percentage, level, or streak (Req 9.3)", () => {
  const done = screenDoneRendered(readHost());
  // The recorded verdict kind must not be rendered as a tally. There must be no
  // ".length" count of attempts/correct answers, no %, and no scoring words in
  // the rendered output.
  assert.ok(!/S\.said\.length\s*\+/.test(done), "no attempt count concatenated into output");
  assert.ok(!/S\.results\.length/.test(done), "no results count rendered");
  assert.ok(!/\bx\.kind\b/.test(done), "the per-attempt verdict kind is not rendered");
  // No scoring metrics in the rendered Done screen. (The learner-facing copy
  // "Nothing was scored. There is no number here on purpose." is reassurance that
  // scoring is ABSENT, not a score — so the bare word "score" is allowed; the
  // forbidden things are rendered metrics: percentages, streaks, levels, points,
  // "N out of M" tallies.)
  for (const metric of ["percent", "%", "streak", " level ", "points", "out of"]) {
    assert.ok(
      !done.toLowerCase().includes(metric.toLowerCase()),
      `Done screen should not render scoring metric: "${metric}"`
    );
  }
  // And it explicitly reassures the learner that nothing was scored.
  assert.match(done, /Nothing was scored/i);
});

// ===========================================================================
// Req 9.4 — no System-generated French on a learner Done screen
// ===========================================================================

test("the authored French teaser is shown for Authored_Content only, never a learner session (Req 9.4)", () => {
  const done = screenDoneSource(readHost());
  // The "franchement / plutôt / carrément" block is authored French. It must be
  // gated so it renders only when NOT a learner session.
  assert.match(done, /franchement/);
  // The teaser is wrapped in a learnerActive() guard that yields "" for a learner
  // session, so no System French reaches a learner Done screen.
  assert.match(done, /learnerActive\(\)\s*\?\s*""\s*:/);
});

// ===========================================================================
// Req 9.5 — empty session shows a plain-English message, no fabrication
// ===========================================================================

test("an empty learner session shows a plain-English 'no sentences were kept' message (Req 9.5)", () => {
  const done = screenDoneSource(readHost());
  // The empty-session branch fires for a learner session with no attempts and no
  // written sentences, and shows a plain-English message rather than empty
  // sections or fabricated evidence.
  assert.match(done, /learnerActive\(\)\s*&&\s*S\.said\.length\s*===\s*0\s*&&\s*mine\.length\s*===\s*0/);
  assert.match(done, /No sentences were kept this session/i);
  // The empty branch still offers the restart affordance (keeps a working product).
  assert.match(done, /id="restart"/);
});

test("the attempts/phrases/sentences sections are omitted when empty, not left as bare headers (Req 9.5)", () => {
  const done = screenDoneSource(readHost());
  // Each evidence section is conditionally rendered so an empty section never
  // leaves a dangling header with no content.
  assert.match(done, /saidList\s*\?\s*"<h2>What you said<\/h2>"/);
  assert.match(done, /phraseList\s*\?\s*"<h2>Phrases worth keeping<\/h2>/);
  assert.match(done, /mine\.length\s*\?\s*"<h2>Sentences you wrote<\/h2>/);
});
