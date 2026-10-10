// render-parity.test.js — example/integration tests for routing a BuiltSession
// through the existing Read/Build/Say-it/Done screens (Task 9.2).
//
// Task 9.2 wires an accepted learner import into the SAME screens the app
// already runs on Authored_Content, with NO learner-built-specific render branch
// (Req 11.2). The screens read their data through one set of source-neutral
// accessors (conv/jamieIdx/phrasesIn/glossOf/usesOf/scene/poolFor) that return
// the same shapes whether the source is Authored_Content or a BuiltSession.
//
// Requirements routed here: 4.3 (shared word-card affordance + English toggle in
// Read), 4.5 (empty-English toggle shows a plain-English "no translation" note),
// 5.4 (word-card gloss/note shown as the app's English), 6.5 (Build keeps the
// up-to-three-attempts/reveal behavior), 7.3/7.4 (five-part Scene with the
// neutral default for reference-poor content), 10.3 (English clearly the app's),
// 11.1 (same Set up → Choose → Read → Build → Say it → Done order; Authored
// behavior unchanged), 11.4 (word-card example gathering also includes learner
// Source_Lines; Authored examples unchanged), 11.5 (only learner-facing labels).
//
// The screen/render logic lives in the host's classic (non-module) script, which
// cannot be imported here, so these tests cover Task 9.2 from the two angles the
// design's Testing Strategy prescribes:
//   1. Host wiring (structural): the host HTML actually routes the BuiltSession
//      through the shared accessors — a learner session is built on "Start →",
//      the Choose step offers the learner's own conversation, the shared
//      screens read scene()/poolFor()/phrasesIn()/glossOf(), the Say-it path
//      routes through judgeLearnerAttempt, and the English toggle shows a plain
//      "no translation" note.
//   2. Public-contract behavior: the exact shape/parity guarantees the screens
//      rely on, driven through the public module surface the bridge re-exports —
//      buildExercises returns the existing shapes, example gathering can include
//      learner Source_Lines, and the Scene is the neutral five-part default.
//
// Uses Node's built-in test runner (node:test), matching the project setup.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { buildExercises, selectWordCards } from "./builder.js";
import { isVerbatimSliceOf } from "./containment.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// src/content-to-exercise/ -> repo root -> the host prototype.
const HOST_HTML = resolve(HERE, "..", "..", "weekend-mission-prototype.html");

function readHost() {
  return readFileSync(HOST_HTML, "utf8");
}

/** Minimal Source_Line factory. */
function line(overrides) {
  return { speaker: null, fr: "", en: "", provenance: "learner", index: 0, ...overrides };
}

// Two Source_Lines so decoys can be drawn and word-cards selected.
function sampleLines() {
  return [
    line({ speaker: "Léa", fr: "J'ai pas eu le temps, franchement.", en: "", index: 0 }),
    line({ speaker: "Max", fr: "Franchement, moi non plus, pas le temps.", en: "", index: 1 }),
  ];
}

// ===========================================================================
// 1. Host wiring: a BuiltSession is routed through the shared screens (Req 11.2)
// ===========================================================================

test("the host builds a learner session from accepted content on Start (Req 11.2)", () => {
  const html = readHost();
  // "Start →" builds the BuiltSession via the pure Exercise_Builder when the
  // learner chose "Bring your own" and has accepted content.
  assert.match(html, /S\.source\s*===\s*"own"/);
  assert.match(html, /bridge\.buildExercises/);
  assert.match(html, /S\.learnerSession\s*=\s*bridge\.buildExercises/);
});

test("conv/jamieIdx/scene/poolFor read the BuiltSession when a learner session is active (Req 11.2)", () => {
  const html = readHost();
  // A single source-neutral switch gates every screen's data source.
  assert.match(html, /learnerActive\s*=\s*\(\)\s*=>\s*!!S\.learnerSession/);
  // conv() returns the BuiltSession transcript; jamieIdx() drills every learner
  // turn; scene() returns the BuiltSession scene; poolFor() asks buildFor().
  assert.match(html, /S\.learnerSession\.transcript/);
  assert.match(html, /S\.learnerSession\.scene/);
  assert.match(html, /S\.learnerSession\.buildFor\(turnIndex\)\.pool/);
});

test("the Choose step offers the learner's own conversation in the same flow order (Req 11.1)", () => {
  const html = readHost();
  // The six-step order is unchanged, and the learner's single option carries the
  // sentinel key so Read follows Choose exactly as for Authored_Content.
  assert.match(html, /const ORDER = \["start","pick","read","build","say","done"\]/);
  assert.match(html, /data-w="__learner__"/);
  assert.match(html, /b\.dataset\.w\s*!==\s*"__learner__"/);
});

test("the Read English toggle shows a plain-English 'no translation' note for empty English (Req 4.5)", () => {
  const html = readHost();
  // turnHTML renders a plain-English note instead of any System-generated
  // translation when a learner turn has no English.
  assert.match(html, /No translation — this line is in your own words\./);
});

test("the Read word-card affordance (annotate) stays shared for a learner session (Req 4.3)", () => {
  const html = readHost();
  // annotate() no longer bails just because S.key is null — a learner session
  // still gets the tappable word-card buttons.
  assert.match(html, /if \(!S\.key && !learnerActive\(\)\) return frEscaped;/);
  assert.match(html, /class="wc" data-card=/);
});

test("the Say-it attempt routes through the learner matcher adapter (Req 11.2 / 8)", () => {
  const html = readHost();
  // A learner session judges the attempt via judgeLearnerAttempt (reference =
  // the learner's own line), not the Authored_Content /api/match branch.
  assert.match(html, /bridge\.judgeLearnerAttempt\(said, target, scene\(\), phrasesIn\(S\.key\)\)/);
  // The reveal is labelled as the learner's own reference, never a generated one.
  assert.match(html, /Your own reference line/);
});

test("the word-card gloss/note are omitted (not fabricated) when the learner gave none (Req 5.4/5.5)", () => {
  const html = readHost();
  // glossOf() returns null en/note for a learner card with no gloss, and cardHTML
  // only renders the English region when it is present — never inventing French.
  assert.match(html, /function\s+glossOf\s*\(/);
  assert.match(html, /g\.en != null \? ' <span class="gloss">/);
});

test("the host shows only learner-facing labels, never internal/provenance names (Req 11.5)", () => {
  const html = readHost();
  // The on-screen speaker label comes from speakerName(), and the learner-session
  // labels are learner-facing English ("Your conversation"), not field/component
  // or provenance identifiers.
  assert.match(html, /function\s+speakerName\s*\(/);
  // No on-screen label leaks an internal identifier. These names may appear in
  // code/comments but never inside a rendered learner-facing string literal.
  for (const internal of ["provenance:\"learner\"", "Source_Line<", "WordCardMap"]) {
    assert.ok(!html.includes(">" + internal), `internal name should not be rendered: ${internal}`);
  }
});

// ===========================================================================
// 2. Public-contract behavior the screens rely on
// ===========================================================================

test("buildExercises returns the four existing shapes the screens consume (Req 11.2)", () => {
  const s = buildExercises(sampleLines());
  // Transcript: Turn[] of [speaker, fr, en].
  assert.ok(Array.isArray(s.transcript));
  for (const t of s.transcript) {
    assert.equal(t.length, 3);
    assert.equal(typeof t[0], "string");
    assert.equal(typeof t[1], "string");
    assert.equal(typeof t[2], "string");
  }
  // Word-cards: { phrase: { en, note, examples } }.
  assert.equal(typeof s.wordCards, "object");
  // Scene: five English parts (Req 7.1).
  for (const part of ["where", "you", "them", "want", "done"]) {
    assert.equal(typeof s.scene[part], "string");
    assert.ok(s.scene[part].length > 0);
  }
  // buildFor(index): a pool of chunk strings (Req 6.*).
  const pool = s.buildFor(0);
  assert.ok(Array.isArray(pool.target));
  assert.ok(Array.isArray(pool.pool));
});

test("the Scene is the neutral five-part default and contains no learner French (Req 7.3/7.5)", () => {
  const lines = sampleLines();
  const s = buildExercises(lines);
  // Success condition is "keep the conversation going" (neutral default).
  assert.match(s.scene.done.toLowerCase(), /conversation going/);
  // No Scene part contains any learner Source_Line French (app-authored English).
  for (const part of Object.values(s.scene)) {
    for (const l of lines) assert.ok(!part.includes(l.fr));
  }
});

test("every French string on the routed session is verbatim learner material (Req 10.3 / Property 1)", () => {
  const lines = sampleLines();
  const s = buildExercises(lines);
  // Transcript fr, word-card phrases + example fr, and Build chunks are all
  // verbatim slices of some Source_Line — the render layer shows no invented
  // French. Scene parts are app-authored English and intentionally excluded.
  for (const [, fr] of s.transcript.map((t) => [t[0], t[1]])) {
    assert.ok(isVerbatimSliceOf(fr, lines), `transcript fr not verbatim: ${fr}`);
  }
  for (const card of Object.values(s.wordCards)) {
    assert.ok(isVerbatimSliceOf(card.phrase, lines), `card phrase not verbatim: ${card.phrase}`);
    for (const ex of card.examples) {
      assert.ok(isVerbatimSliceOf(ex.fr, lines), `example fr not verbatim: ${ex.fr}`);
    }
  }
  for (let i = 0; i < lines.length; i++) {
    for (const chunk of s.buildFor(i).pool) {
      assert.ok(isVerbatimSliceOf(chunk, lines), `pool chunk not verbatim: ${chunk}`);
    }
  }
});

test("word-card example gathering includes learner Source_Lines, labelled with origin (Req 11.4)", () => {
  const lines = sampleLines();
  const cards = selectWordCards(lines);
  const names = Object.keys(cards);
  assert.ok(names.length >= 1, "a recurring phrase should yield at least one card");
  // At least one card draws its examples from the learner's own Source_Lines,
  // each example labelled with a learner-facing origin (speaker · line N).
  let sawLearnerExample = false;
  for (const card of Object.values(cards)) {
    for (const ex of card.examples) {
      assert.ok(lines.some((l) => l.fr === ex.fr), "example fr is a learner Source_Line");
      assert.match(ex.src, /·\s*line\s*\d+/i); // origin label: speaker · line N
      sawLearnerExample = true;
    }
  }
  assert.ok(sawLearnerExample, "examples should be gathered from learner Source_Lines");
});

test("a decoy-free single-line session routes a pool equal to its target (Req 6.6 render parity)", () => {
  // One Source_Line => no other line to draw decoys from => pool === target.
  const s = buildExercises([line({ speaker: "Léa", fr: "On y va maintenant.", index: 0 })]);
  const pool = s.buildFor(0);
  assert.deepEqual([...pool.pool].sort(), [...pool.target].sort());
});
