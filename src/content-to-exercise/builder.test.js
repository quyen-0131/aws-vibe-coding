// builder.test.js — unit tests for Exercise_Builder transforms.
//
// Scope (Task 4.1): buildTranscript — one Turn per Source_Line in order, fr
// verbatim, en = learner-supplied English or "" (never invented)
// (Requirements 4.1, 4.2, 4.4).
//
// Uses Node's built-in test runner (node:test), matching the project setup.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildTranscript,
  selectWordCards,
  chunksOf,
  buildPool,
  buildScene,
  buildExercises,
  degradedReasons,
} from "./builder.js";
import { isVerbatimSliceOf } from "./containment.js";

/**
 * Minimal Source_Line factory for tests.
 * @param {Partial<import("./types.js").SourceLine>} overrides
 */
function line(overrides) {
  return {
    speaker: null,
    fr: "",
    en: "",
    provenance: "learner",
    index: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// One turn per Source_Line, in order (Requirement 4.1)
// ---------------------------------------------------------------------------

test("produces one [speaker, fr, en] turn per Source_Line, preserving order", () => {
  const sourceLines = [
    line({ speaker: "Alex", fr: "Salut !", en: "Hi!", index: 0 }),
    line({ speaker: "Jamie", fr: "Ça va ?", en: "", index: 1 }),
    line({ speaker: "Alex", fr: "Oui, plutôt.", en: "Yeah, pretty good.", index: 2 }),
  ];

  const turns = buildTranscript(sourceLines);

  assert.equal(turns.length, 3);
  assert.deepEqual(turns, [
    ["Alex", "Salut !", "Hi!"],
    ["Jamie", "Ça va ?", ""],
    ["Alex", "Oui, plutôt.", "Yeah, pretty good."],
  ]);
});

// ---------------------------------------------------------------------------
// fr reproduced verbatim, including accents/contractions (Requirements 4.1, 4.4)
// ---------------------------------------------------------------------------

test("reproduces fr verbatim, preserving accents, casing, and contractions", () => {
  const fr = "T'as passé un bon week-end ? J'ai pas eu le temps…";
  const turns = buildTranscript([line({ speaker: "Alex", fr, en: "", index: 0 })]);

  assert.equal(turns[0][1], fr);
});

// ---------------------------------------------------------------------------
// en = learner-supplied English or "" — never invented (Requirement 4.2)
// ---------------------------------------------------------------------------

test("uses the learner-supplied English for the turn when present", () => {
  const turns = buildTranscript([
    line({ speaker: "You", fr: "On y va.", en: "Let's go.", index: 0 }),
  ]);
  assert.equal(turns[0][2], "Let's go.");
});

test("leaves en empty when the learner supplied none, never inventing a translation", () => {
  const turns = buildTranscript([
    line({ speaker: "You", fr: "On y va.", en: "", index: 0 }),
  ]);
  assert.equal(turns[0][2], "");
});

test("normalizes a null/missing learner English to an empty string", () => {
  const turns = buildTranscript([
    // en deliberately null to simulate a missing learner English.
    line({ speaker: "You", fr: "On y va.", en: null, index: 0 }),
  ]);
  assert.equal(turns[0][2], "");
});

// ---------------------------------------------------------------------------
// Unattributed speaker (null) becomes "" without inventing a label
// ---------------------------------------------------------------------------

test("maps an unattributed Source_Line (speaker null) to an empty-string speaker", () => {
  const turns = buildTranscript([line({ speaker: null, fr: "Bonjour.", en: "", index: 0 })]);
  assert.equal(turns[0][0], "");
});

// ---------------------------------------------------------------------------
// Edge: empty / non-array input
// ---------------------------------------------------------------------------

test("returns an empty transcript for an empty Source_Line list", () => {
  assert.deepEqual(buildTranscript([]), []);
});

test("returns an empty transcript for non-array input", () => {
  assert.deepEqual(buildTranscript(null), []);
  assert.deepEqual(buildTranscript(undefined), []);
});

// ===========================================================================
// selectWordCards (Task 4.2) — Requirements 5.1, 5.2, 5.3, 5.5, 5.6
// ===========================================================================

function sampleLines() {
  return [
    line({ speaker: "Alex", fr: "T'as passé un bon week-end ?", en: "", index: 0 }),
    line({ speaker: "Jamie", fr: "Oui, plutôt. J'ai pas fait grand-chose.", en: "", index: 1 }),
    line({ speaker: "Alex", fr: "Ah bon, plutôt tranquille alors.", en: "", index: 2 }),
  ];
}

// --- 5.1: between 1 and 12 cards, each phrase verbatim in >= 1 Source_Line ---

test("returns between 1 and 12 cards for non-trivial content", () => {
  const cards = selectWordCards(sampleLines());
  const keys = Object.keys(cards);
  assert.ok(keys.length >= 1, "expected at least one card");
  assert.ok(keys.length <= 12, "expected at most twelve cards");
});

test("every card phrase occurs verbatim in at least one Source_Line", () => {
  const lines = sampleLines();
  const cards = selectWordCards(lines);
  for (const phrase of Object.keys(cards)) {
    assert.ok(
      isVerbatimSliceOf(phrase, lines),
      `phrase "${phrase}" is not a verbatim slice of any Source_Line`
    );
    assert.equal(cards[phrase].phrase, phrase);
  }
});

test("caps the number of cards at 12 even for long content", () => {
  const lines = [];
  for (let i = 0; i < 30; i++) {
    lines.push(line({ speaker: "You", fr: `phrase numéro ${i} ici voilà`, index: i }));
  }
  const cards = selectWordCards(lines);
  assert.ok(Object.keys(cards).length <= 12);
});

// --- 5.2: phrase is exact verbatim text (accents/casing/contractions) ---

test("preserves accents, casing, and contractions in the phrase verbatim", () => {
  const lines = [
    line({ speaker: "A", fr: "Carrément génial çà.", index: 0 }),
    line({ speaker: "B", fr: "Carrément oui.", index: 1 }),
  ];
  const cards = selectWordCards(lines);
  for (const phrase of Object.keys(cards)) {
    assert.ok(isVerbatimSliceOf(phrase, lines));
  }
  // The recurring exact-case token "Carrément" should be selectable verbatim.
  assert.ok(
    Object.keys(cards).some((p) => p.includes("Carrément")),
    "expected a card containing the verbatim 'Carrément'"
  );
});

// --- 5.3: 1..3 examples, verbatim fr, labelled with origin (speaker+position) ---

test("each card carries between 1 and 3 origin-labelled verbatim examples", () => {
  const lines = sampleLines();
  const cards = selectWordCards(lines);
  for (const phrase of Object.keys(cards)) {
    const examples = cards[phrase].examples;
    assert.ok(examples.length >= 1 && examples.length <= 3, "1..3 examples");
    for (const ex of examples) {
      assert.ok(isVerbatimSliceOf(ex.fr, lines), "example fr is verbatim");
      assert.equal(typeof ex.src, "string");
      assert.ok(ex.src.length > 0, "example has an origin label");
      // Origin label carries speaker and position (e.g. "Alex · line 1").
      assert.match(ex.src, /line \d+/);
    }
  }
});

test("recurring phrase gathers examples from multiple distinct Source_Lines", () => {
  const lines = [
    line({ speaker: "Alex", fr: "Oui, plutôt.", index: 0 }),
    line({ speaker: "Jamie", fr: "Plutôt bien oui.", index: 1 }),
    line({ speaker: "Alex", fr: "plutôt tranquille.", index: 2 }),
  ];
  const cards = selectWordCards(lines);
  const plutot = cards["plutôt"];
  assert.ok(plutot, "expected a 'plutôt' card from the recurring lowercase token");
  // Two lines contain the exact lowercase "plutôt" → up to 3 examples, >= 2 here.
  assert.ok(plutot.examples.length >= 2);
});

// --- 5.5: no learner gloss → en/note null; phrase + examples still present ---

test("sets en and note to null when the learner supplied no gloss", () => {
  const cards = selectWordCards(sampleLines());
  for (const phrase of Object.keys(cards)) {
    assert.equal(cards[phrase].en, null);
    assert.equal(cards[phrase].note, null);
    assert.ok(cards[phrase].examples.length >= 1, "examples still present");
  }
});

// --- 5.6: zero cards rather than fabricate ---

test("produces zero cards for empty or whitespace-only / invalid input", () => {
  assert.deepEqual(selectWordCards([]), {});
  assert.deepEqual(selectWordCards(null), {});
  assert.deepEqual(selectWordCards(undefined), {});
  assert.deepEqual(selectWordCards([line({ fr: "", index: 0 })]), {});
});

// ===========================================================================
// chunksOf (Task 5.1) — Requirement 6.1
// Reuses the prototype chunk() splitter: split on (?<=[,.!?…])\s+, then group
// into 2-word pieces (3-word pieces when a part runs longer than 6 words).
// ===========================================================================

// --- Groups a short clause into 2-word pieces ---

test("groups a short clause into 2-word pieces (verbatim words, in order)", () => {
  const chunks = chunksOf(line({ fr: "On y va maintenant", index: 0 }));
  assert.deepEqual(chunks, ["On y", "va maintenant"]);
});

// --- Splits after each terminator, keeping it attached to its clause ---

test("splits after sentence/clause terminators, keeping the terminator attached", () => {
  // "Oui, plutôt." -> parts ["Oui,", "plutôt."] -> each a single 2-word-max piece.
  const chunks = chunksOf(line({ fr: "Oui, plutôt.", index: 0 }));
  assert.deepEqual(chunks, ["Oui,", "plutôt."]);
});

// --- A part longer than 6 words switches to 3-word pieces ---

test("uses 3-word pieces when a part runs longer than 6 words", () => {
  // 7 words, no internal terminator -> single part -> grouped by 3.
  const chunks = chunksOf(line({ fr: "un deux trois quatre cinq six sept", index: 0 }));
  assert.deepEqual(chunks, ["un deux trois", "quatre cinq six", "sept"]);
});

test("uses 2-word pieces when a part is 6 words or fewer", () => {
  const chunks = chunksOf(line({ fr: "un deux trois quatre cinq six", index: 0 }));
  assert.deepEqual(chunks, ["un deux", "trois quatre", "cinq six"]);
});

// --- The ordered word sequence of chunks reconstructs the line (Property 10) ---

test("the ordered words of the chunks reconstruct the Source_Line's words", () => {
  const fr = "T'as passé un bon week-end ? J'ai pas eu le temps…";
  const chunks = chunksOf(line({ fr, index: 0 }));
  const chunkWords = chunks.join(" ").split(/\s+/).filter(Boolean);
  const lineWords = fr.split(/\s+/).filter(Boolean);
  assert.deepEqual(chunkWords, lineWords);
});

// --- Every chunk is built from the line's own words (no invented French) ---

test("preserves accents and contractions within chunks", () => {
  const chunks = chunksOf(line({ fr: "J'ai pas eu", index: 0 }));
  assert.deepEqual(chunks, ["J'ai pas", "eu"]);
});

// --- Edge: empty / invalid input ---

test("returns an empty chunk list for an empty line", () => {
  assert.deepEqual(chunksOf(line({ fr: "", index: 0 })), []);
});

test("returns an empty chunk list for invalid input", () => {
  assert.deepEqual(chunksOf(null), []);
  assert.deepEqual(chunksOf(undefined), []);
  assert.deepEqual(chunksOf({}), []);
});

// ===========================================================================
// buildPool (Task 5.2) — Requirements 6.2, 6.3, 6.4, 6.6
// Target chunks from the selected line; decoys drawn ONLY from other
// Source_Lines; exclude decoys equal to a target chunk (trimmed, case-sensitive,
// accent-preserving); 0..4 decoys so pool.length <= target.length + 4; no other
// line => target chunks alone, zero decoys.
// ===========================================================================

function poolLines() {
  return [
    line({ speaker: "Alex", fr: "On y va maintenant.", index: 0 }),
    line({ speaker: "Jamie", fr: "Je prends mon manteau.", index: 1 }),
    line({ speaker: "Alex", fr: "Il fait vraiment froid dehors.", index: 2 }),
  ];
}

// --- target is the selected line's chunks (Requirement 6.1 reuse) ---

test("target equals the selected Source_Line's chunks", () => {
  const lines = poolLines();
  const { target } = buildPool(0, lines);
  assert.deepEqual(target, chunksOf(lines[0]));
});

// --- decoys come only from OTHER Source_Lines (Requirement 6.2) ---

test("every decoy (pool chip not in target) is a chunk of some OTHER Source_Line", () => {
  const lines = poolLines();
  const { target, pool } = buildPool(0, lines);

  const targetKeys = new Set(target.map((c) => c.trim()));
  const otherChunkKeys = new Set();
  lines.forEach((l, i) => {
    if (i === 0) return;
    for (const c of chunksOf(l)) otherChunkKeys.add(c.trim());
  });

  for (const chip of pool) {
    if (targetKeys.has(chip.trim())) continue; // a target chip
    assert.ok(
      otherChunkKeys.has(chip.trim()),
      `decoy "${chip}" did not come from another Source_Line`
    );
  }
});

// --- no decoy equals a target chunk under trimmed comparison (Requirement 6.3) ---

test("excludes a decoy whose trimmed text equals a target chunk", () => {
  // Both lines share the clause "On y va" → that chunk must not appear as a decoy.
  const lines = [
    line({ speaker: "A", fr: "On y va maintenant.", index: 0 }),
    line({ speaker: "B", fr: "On y va aussi vite.", index: 1 }),
  ];
  const { target, pool } = buildPool(0, lines);

  const targetKeys = new Set(target.map((c) => c.trim()));
  // Count occurrences of each target chunk in the pool: a target chunk appears
  // exactly once (from the target), never duplicated by a decoy.
  for (const key of targetKeys) {
    const count = pool.filter((c) => c.trim() === key).length;
    assert.equal(count, 1, `target chunk "${key}" should appear once, not duplicated by a decoy`);
  }
});

// --- 0..4 decoys so pool.length <= target.length + 4 (Requirement 6.4) ---

test("includes at most 4 decoys so pool.length <= target.length + 4", () => {
  // Many other lines → more than 4 candidate decoys available; must cap at 4.
  const lines = [
    line({ speaker: "A", fr: "Phrase cible ici.", index: 0 }),
    line({ speaker: "B", fr: "alpha bravo charlie delta echo foxtrot.", index: 1 }),
    line({ speaker: "C", fr: "golf hotel india juliett kilo lima.", index: 2 }),
    line({ speaker: "D", fr: "mike november oscar papa quebec romeo.", index: 3 }),
  ];
  const { target, pool } = buildPool(0, lines);
  assert.ok(
    pool.length <= target.length + 4,
    `pool.length ${pool.length} exceeded target.length ${target.length} + 4`
  );
  const decoyCount = pool.length - target.length;
  assert.ok(decoyCount >= 0 && decoyCount <= 4, "0..4 decoys");
});

// --- pool contains exactly the target chunks plus the decoys ---

test("pool is a permutation of the target chunks plus the chosen decoys", () => {
  const lines = poolLines();
  const { target, pool } = buildPool(0, lines);
  // Every target chunk is present in the pool.
  for (const t of target) {
    assert.ok(pool.includes(t), `pool is missing target chunk "${t}"`);
  }
  // Pool size is at least the target size.
  assert.ok(pool.length >= target.length);
});

// --- no other line => target chunks alone, zero decoys (Requirement 6.6) ---

test("builds from target chunks alone with zero decoys when no OTHER line exists", () => {
  const lines = [line({ speaker: "A", fr: "On y va maintenant.", index: 0 })];
  const { target, pool } = buildPool(0, lines);
  assert.deepEqual(target, chunksOf(lines[0]));
  // Pool is exactly the target chunks (same multiset), no fabricated decoys.
  assert.equal(pool.length, target.length);
  assert.deepEqual([...pool].sort(), [...target].sort());
});

// --- determinism: pure function of its inputs ---

test("is deterministic — same inputs yield the same pool", () => {
  const lines = poolLines();
  const a = buildPool(1, lines);
  const b = buildPool(1, lines);
  assert.deepEqual(a, b);
});

// --- Edge: empty / invalid / out-of-range input ---

test("returns empty target and pool for empty or invalid input", () => {
  assert.deepEqual(buildPool(0, []), { target: [], pool: [] });
  assert.deepEqual(buildPool(0, null), { target: [], pool: [] });
  assert.deepEqual(buildPool(0, undefined), { target: [], pool: [] });
});

test("returns empty target and pool when targetIndex is out of range", () => {
  const lines = poolLines();
  assert.deepEqual(buildPool(99, lines), { target: [], pool: [] });
});

// ===========================================================================
// buildScene (Task 5.3) — Requirements 7.1, 7.2, 7.5
// Five non-empty English parts; neutral default Scene whose success condition is
// "keep the conversation going"; never copy/translate Learner_Content French.
// ===========================================================================

const SCENE_PARTS = ["where", "you", "them", "want", "done"];

function sceneSampleLines() {
  return [
    line({ speaker: "Alex", fr: "T'as passé un bon week-end ?", en: "", index: 0 }),
    line({ speaker: "Jamie", fr: "Oui, plutôt. J'ai pas fait grand-chose.", en: "", index: 1 }),
    line({ speaker: "Alex", fr: "Ah bon, plutôt tranquille alors.", en: "", index: 2 }),
  ];
}

// --- 7.1: all five parts populated and non-empty ---

test("produces all five Scene parts, each a non-empty string", () => {
  const scene = buildScene(sceneSampleLines());
  for (const part of SCENE_PARTS) {
    assert.equal(typeof scene[part], "string", `${part} should be a string`);
    assert.ok(scene[part].trim().length > 0, `${part} should be non-empty`);
  }
});

test("returns a Scene with exactly the five expected keys", () => {
  const scene = buildScene(sceneSampleLines());
  assert.deepEqual(Object.keys(scene).sort(), [...SCENE_PARTS].sort());
});

// --- 7.3: neutral default whose success condition keeps the conversation going ---

test("the success condition (done) is about keeping the conversation going", () => {
  const scene = buildScene(sceneSampleLines());
  assert.match(scene.done, /conversation going/i);
});

// --- 7.5: no Scene part contains any Source_Line French as a substring ---

test("no Scene part contains any Source_Line French as a substring", () => {
  const lines = sceneSampleLines();
  const scene = buildScene(lines);
  for (const part of SCENE_PARTS) {
    for (const l of lines) {
      assert.ok(
        !scene[part].includes(l.fr),
        `Scene part "${part}" must not contain the learner French "${l.fr}"`
      );
    }
  }
});

// --- Edge: empty / invalid input still yields the complete neutral default ---

test("yields the complete neutral default Scene for empty or invalid input", () => {
  for (const input of [[], null, undefined]) {
    const scene = buildScene(input);
    for (const part of SCENE_PARTS) {
      assert.ok(
        typeof scene[part] === "string" && scene[part].trim().length > 0,
        `${part} should be a non-empty string for input ${JSON.stringify(input)}`
      );
    }
    assert.match(scene.done, /conversation going/i);
  }
});

// --- Scene is app-authored English, independent of input content ---

test("the Scene does not depend on learner content (same output for any input)", () => {
  const a = buildScene(sceneSampleLines());
  const b = buildScene([line({ speaker: "Bob", fr: "Bonjour le monde.", index: 0 })]);
  assert.deepEqual(a, b);
});

// --- Returns a fresh (mutable) copy, not a shared frozen constant ---

test("returns a fresh copy so callers can mutate without affecting later calls", () => {
  const first = buildScene(sceneSampleLines());
  first.where = "mutated";
  const second = buildScene(sceneSampleLines());
  assert.notEqual(second.where, "mutated");
});

// ===========================================================================
// buildExercises (Task 5.4) — Requirement 11.2
// Composes transcript, wordCards, scene, and buildFor(index) into a
// BuiltSession matching the existing Read/Build/Say-it/Done shapes, with no
// learner-built-specific render path. These unit tests check the COMPOSITION
// (delegation to the four transforms + the buildFor closure); the broad
// shape-conformance property is covered separately (Property 15, Task 5.8).
// ===========================================================================

function builtSessionLines() {
  return [
    line({ speaker: "Alex", fr: "On y va maintenant.", en: "Let's go now.", index: 0 }),
    line({ speaker: "Jamie", fr: "Oui, plutôt. J'ai pas fait grand-chose.", en: "", index: 1 }),
    line({ speaker: "Alex", fr: "Ah bon, plutôt tranquille alors.", en: "", index: 2 }),
  ];
}

test("exposes the four BuiltSession fields: transcript, wordCards, scene, buildFor", () => {
  const session = buildExercises(builtSessionLines());
  assert.ok(Array.isArray(session.transcript), "transcript is an array of Turns");
  assert.equal(typeof session.wordCards, "object", "wordCards is a map");
  assert.ok(session.wordCards !== null, "wordCards is a non-null map");
  assert.equal(typeof session.scene, "object", "scene is an object");
  assert.equal(typeof session.buildFor, "function", "buildFor is a function");
});

test("delegates transcript, wordCards, and scene to the underlying transforms", () => {
  const lines = builtSessionLines();
  const session = buildExercises(lines);
  assert.deepEqual(session.transcript, buildTranscript(lines));
  assert.deepEqual(session.wordCards, selectWordCards(lines));
  assert.deepEqual(session.scene, buildScene(lines));
});

test("buildFor(index) returns the Build pool for that Source_Line (matches buildPool)", () => {
  const lines = builtSessionLines();
  const session = buildExercises(lines);
  for (let i = 0; i < lines.length; i++) {
    assert.deepEqual(session.buildFor(i), buildPool(i, lines));
  }
});

test("buildFor draws decoys from the learner's own other Source_Lines", () => {
  const lines = builtSessionLines();
  const session = buildExercises(lines);
  const { target, pool } = session.buildFor(0);

  const targetKeys = new Set(target.map((c) => c.trim()));
  const otherChunkKeys = new Set();
  lines.forEach((l, i) => {
    if (i === 0) return;
    for (const c of chunksOf(l)) otherChunkKeys.add(c.trim());
  });
  for (const chip of pool) {
    if (targetKeys.has(chip.trim())) continue;
    assert.ok(
      otherChunkKeys.has(chip.trim()),
      `decoy "${chip}" did not come from another Source_Line`
    );
  }
});

test("returns a well-formed BuiltSession for empty / invalid input (no throw)", () => {
  for (const input of [[], null, undefined]) {
    const session = buildExercises(input);
    assert.deepEqual(session.transcript, []);
    assert.deepEqual(session.wordCards, {});
    // Scene is always the complete neutral default.
    for (const part of ["where", "you", "them", "want", "done"]) {
      assert.ok(
        typeof session.scene[part] === "string" && session.scene[part].trim().length > 0
      );
    }
    assert.deepEqual(session.buildFor(0), { target: [], pool: [] });
  }
});

test("every French string in the BuiltSession is a verbatim slice of a Source_Line", () => {
  const lines = builtSessionLines();
  const session = buildExercises(lines);

  // Transcript fr (index 1 of each Turn).
  for (const [, fr] of session.transcript) {
    assert.ok(isVerbatimSliceOf(fr, lines), `transcript fr "${fr}" not verbatim`);
  }
  // Word-card phrases and example fr.
  for (const phrase of Object.keys(session.wordCards)) {
    assert.ok(isVerbatimSliceOf(phrase, lines), `phrase "${phrase}" not verbatim`);
    for (const ex of session.wordCards[phrase].examples) {
      assert.ok(isVerbatimSliceOf(ex.fr, lines), `example "${ex.fr}" not verbatim`);
    }
  }
  // Build pool chunks for every line.
  for (let i = 0; i < lines.length; i++) {
    const { pool } = session.buildFor(i);
    for (const chip of pool) {
      assert.ok(isVerbatimSliceOf(chip, lines), `pool chip "${chip}" not verbatim`);
    }
  }
});

// ===========================================================================
// degradedReasons (Task 9.4) — Requirement 10.5
// When a build step cannot complete without inventing French it emits its
// defined degraded form (zero Word_Cards, decoy-free Build pool, neutral
// default Scene), leaves recorded learner material unchanged, and surfaces a
// plain-English reason. degradedReasons reports those reasons; it must never
// invent French and must contain only app-authored English.
// ===========================================================================

const FRENCH_ACCENT_RE = /[àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ]/;

// --- The neutral default Scene always applies, so content yields that reason ---

test("surfaces a plain-English reason for the neutral default Scene", () => {
  const reasons = degradedReasons(builtSessionLines());
  assert.ok(
    reasons.some((r) => /scene/i.test(r) && /neutral/i.test(r)),
    "expected a plain-English reason explaining the neutral default Scene"
  );
});

// --- A single Source_Line has no OTHER line, so Build is decoy-free (6.6) ---

test("surfaces a plain-English reason when the Build pool is decoy-free (single line)", () => {
  const reasons = degradedReasons([
    line({ speaker: "A", fr: "On y va maintenant.", index: 0 }),
  ]);
  assert.ok(
    reasons.some((r) => /chip/i.test(r) || /distractor/i.test(r)),
    "expected a plain-English reason explaining the decoy-free Build pool"
  );
});

// --- Multi-line content with decoys available does NOT report decoy-free ---

test("does not report a decoy-free Build pool when other lines supply decoys", () => {
  // Distinct lines so each buildable line has decoys drawn from the others.
  const lines = [
    line({ speaker: "A", fr: "On y va maintenant.", index: 0 }),
    line({ speaker: "B", fr: "Je prends mon manteau.", index: 1 }),
    line({ speaker: "C", fr: "Il fait vraiment froid dehors.", index: 2 }),
  ];
  // Confirm the premise: at least one buildable line, and every buildable pool
  // has at least one decoy (pool longer than its target).
  let sawDecoy = false;
  for (let i = 0; i < lines.length; i++) {
    const { target, pool } = buildPool(i, lines);
    if (target.length > 0 && pool.length > target.length) sawDecoy = true;
  }
  assert.ok(sawDecoy, "fixture should provide at least one decoy somewhere");

  const reasons = degradedReasons(lines);
  assert.ok(
    !reasons.some((r) => /chip/i.test(r) || /distractor/i.test(r)),
    "should not report a decoy-free Build pool when decoys are available"
  );
});

// --- Empty / invalid input is the no-content case, not a degraded build step ---

test("returns no reasons for empty or invalid input (no content, not a halted step)", () => {
  for (const input of [[], null, undefined, [line({ fr: "", index: 0 })]]) {
    assert.deepEqual(degradedReasons(input), []);
  }
});

// --- Reasons are plain English only: no French, no internal field names ---

test("reasons contain only plain English — no French and no internal names", () => {
  const inputs = [
    [line({ speaker: "A", fr: "On y va maintenant.", index: 0 })], // decoy-free + scene
    builtSessionLines(), // scene only
  ];
  const internalNames = [
    "Source_Line", "Word_Card", "WordCard", "wordCards", "buildPool",
    "degradedReasons", "Provenance", "BuiltSession", "Scene part",
  ];
  for (const input of inputs) {
    const reasons = degradedReasons(input);
    for (const r of reasons) {
      assert.equal(typeof r, "string");
      assert.ok(r.trim().length > 0, "reason is non-empty");
      // No accented French characters leaked into the reason text.
      assert.ok(!FRENCH_ACCENT_RE.test(r), `reason leaked French: "${r}"`);
      // No learner French line appears verbatim in the reason.
      for (const l of input) {
        if (l && l.fr) assert.ok(!r.includes(l.fr), `reason copied learner French: "${r}"`);
      }
      // No internal/developer-facing field or component names (Req 11.5).
      for (const name of internalNames) {
        assert.ok(!r.includes(name), `reason exposed internal name "${name}"`);
      }
    }
  }
});

// --- degradedReasons is pure: it does not mutate the Source_Lines ---

test("does not mutate the Source_Lines it inspects", () => {
  const lines = builtSessionLines();
  const snapshot = JSON.parse(JSON.stringify(lines));
  degradedReasons(lines);
  assert.deepEqual(lines, snapshot, "Source_Lines must be left unchanged");
});

// --- buildExercises carries the same degradedReasons on the BuiltSession ---

test("buildExercises exposes degradedReasons matching the helper", () => {
  const lines = builtSessionLines();
  const session = buildExercises(lines);
  assert.ok(Array.isArray(session.degradedReasons), "degradedReasons is an array");
  assert.deepEqual(session.degradedReasons, degradedReasons(lines));
});

test("buildExercises reports no degraded reasons for empty / invalid input", () => {
  for (const input of [[], null, undefined]) {
    const session = buildExercises(input);
    assert.deepEqual(session.degradedReasons, []);
  }
});
