// render-parity-privacy.test.js — example/integration tests for render parity
// AND privacy (Task 9.6).
//
// Task 9.6 is the consolidating integration pass over the learner-built flow: it
// checks that an accepted learner import is rendered through the SAME screens the
// app already runs on Authored_Content (render parity), and that Learner_Content
// stays on the device (privacy). It differs from render-parity.test.js (Task 9.2,
// the routing wire-up) by anchoring the specific parity/privacy guarantees Task
// 9.6 enumerates:
//
//   - 4.3 / 4.5  Read renders the learner transcript through the shared
//                word-card affordance and English toggle; empty English shows a
//                plain-English "no translation" note.
//   - 5.4        Word-card gloss/note render in the English region, labelled as
//                the app's English (never passed off as the learner's French).
//   - 5.6        Zero-candidate input yields zero Word_Cards (no fabrication).
//   - 6.5        Build keeps the existing up-to-three-attempts + reveal behavior,
//                shared by learner and Authored_Content sessions alike.
//   - 7.3 / 7.4  Scene renders via the five-part layout, with the neutral default
//                for reference-poor content.
//   - 9.5        Done shows a plain-English empty-session message, no fabricated
//                evidence.
//   - 11.1 / 11.4 / 11.5  The learner flow advances in the same order; word-card
//                example gathering also includes learner Source_Lines while
//                Authored_Content gathering is unchanged (regression); only
//                learner-facing labels are shown.
//   - 12.2 / 12.5  Learner_Content writes only to local storage (no account, no
//                network, no cross-device sync); cleared storage yields first-run
//                behavior that offers the Authored_Content path.
//
// The screen/render logic lives in the host's classic (non-module) script, which
// cannot be imported here, so — matching the sibling example tests — these cover
// Task 9.6 from two angles:
//   1. Host wiring (structural): the host HTML routes a BuiltSession through the
//      shared screens/accessors, keeps the Build attempts/reveal handlers common
//      to both sources, renders the Scene via the single five-part sceneHTML, and
//      persists accepted content only to local storage via saveLearnerContent.
//   2. Public-contract behavior: the shape/parity/privacy guarantees driven
//      through the public module surface — zero-candidate → zero cards, the
//      neutral five-part Scene with no learner French, example gathering over
//      learner Source_Lines, and the local-only first-run persistence contract.
//
// Uses Node's built-in test runner (node:test), matching the project setup.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { buildExercises, selectWordCards, buildScene } from "./builder.js";
import { isVerbatimSliceOf } from "./containment.js";
import {
  saveLearnerContent,
  loadLearnerContent,
  STORAGE_KEY,
  STORAGE_VERSION,
} from "./persistence.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// src/content-to-exercise/ -> repo root -> the host prototype.
const HOST_HTML = resolve(HERE, "..", "..", "weekend-mission-prototype.html");
const readHost = () => readFileSync(HOST_HTML, "utf8");

/** Minimal Source_Line factory. */
function line(overrides) {
  return { speaker: null, fr: "", en: "", provenance: "learner", index: 0, ...overrides };
}

// Two Source_Lines so decoys can be drawn and recurring word-cards selected.
function sampleLines() {
  return [
    line({ speaker: "Léa", fr: "J'ai pas eu le temps, franchement.", en: "", index: 0 }),
    line({ speaker: "Max", fr: "Franchement, moi non plus, pas le temps.", en: "", index: 1 }),
  ];
}

// A minimal in-memory Web Storage stand-in (matching persistence.test.js) so the
// first-run / cleared-storage contract can be exercised under node where
// globalThis.localStorage is absent.
function makeMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
    _raw: () => Object.fromEntries(map),
    _has: (k) => map.has(k),
  };
}

// ===========================================================================
// Read parity — shared word-card affordance + English toggle (Req 4.3, 4.5)
// ===========================================================================

test("Read renders a learner Transcript through the shared screen, not a learner-only path (Req 4.3/11.2)", () => {
  const html = readHost();
  // screenRead builds its turns from conv(), the source-neutral accessor that
  // returns the BuiltSession transcript for a learner session — the same code
  // path Authored_Content uses, with no learner-built-specific Read renderer.
  assert.match(html, /function\s+screenRead\s*\(/);
  assert.match(html, /conv\(\)\.turns\.map\(x\s*=>\s*turnHTML\(x\[0\],\s*x\[1\],\s*x\[2\]\)\)/);
});

test("the shared tappable word-card affordance stays active for a learner session (Req 4.3)", () => {
  const html = readHost();
  // annotate() renders the tappable word-card buttons for a learner session too
  // (it only bails when there is neither an Authored key nor a learner session).
  assert.match(html, /if \(!S\.key && !learnerActive\(\)\) return frEscaped;/);
  assert.match(html, /class="wc" data-card=/);
});

test("the Read English toggle shows a plain-English 'no translation' note, never invented French (Req 4.5)", () => {
  const html = readHost();
  // The single English toggle control is shared; an empty-English learner turn
  // shows a plain-English note instead of any System-generated translation.
  assert.match(html, /id="toggle"/);
  assert.match(html, /No translation — this line is in your own words\./);
});

// ===========================================================================
// Word-cards — gloss labelled as the app's; zero-candidate → zero (Req 5.4, 5.6)
// ===========================================================================

test("word-card gloss/note render in the English region, labelled as the app's English (Req 5.4)", () => {
  const html = readHost();
  // cardHTML only emits the English gloss region when a gloss is present, and it
  // sits in an English ".gloss" span — app-authored English, never the learner's
  // French. glossOf() supplies null for a learner card with no gloss.
  assert.match(html, /function\s+glossOf\s*\(/);
  assert.match(html, /g\.en != null \? ' <span class="gloss">/);
});

test("zero-candidate input yields zero Word_Cards rather than a fabricated phrase (Req 5.6)", () => {
  // No Source_Lines => no candidate phrases => zero cards (never fabricated).
  assert.deepEqual(selectWordCards([]), {});

  // Whitespace-only / empty fr carries no selectable phrase either.
  const noPhrase = [
    line({ fr: "   ", index: 0 }),
    line({ fr: "", index: 1 }),
  ];
  assert.deepEqual(selectWordCards(noPhrase), {});

  // Non-array / malformed input is treated as zero candidates, never fabricated.
  assert.deepEqual(selectWordCards(null), {});

  // And the aggregate BuiltSession carries an empty wordCards map in that case,
  // so the Read screen simply shows no cards (the degraded form, not invented).
  const session = buildExercises(noPhrase);
  assert.deepEqual(session.wordCards, {});
});

test("a learner card with no supplied gloss keeps phrase + examples but omits the gloss (Req 5.4/5.5)", () => {
  const cards = selectWordCards(sampleLines());
  const names = Object.keys(cards);
  assert.ok(names.length >= 1, "a recurring phrase should yield at least one card");
  for (const card of Object.values(cards)) {
    assert.equal(card.en, null); // no learner gloss => null, not fabricated French
    assert.equal(card.note, null);
    assert.ok(card.examples.length >= 1); // phrase still carries real example uses
  }
});

// ===========================================================================
// Build — existing up-to-three-attempts and reveal behavior (Req 6.5)
// ===========================================================================

test("Build reads its chip pool through the shared poolFor accessor (Req 6.5/11.2)", () => {
  const html = readHost();
  // screenBuild asks poolFor(at); for a learner session poolFor returns the
  // BuiltSession's buildFor(index).pool — the same flat chunk-string array the
  // Build screen renders for Authored_Content.
  assert.match(html, /function\s+screenBuild\s*\(/);
  assert.match(html, /const pool\s*=\s*poolFor\(at\)/);
  assert.match(html, /S\.learnerSession\.buildFor\(turnIndex\)\.pool/);
});

test("Build keeps the up-to-three-attempts counter and post-third-attempt reveal, unchanged (Req 6.5)", () => {
  const html = readHost();
  // The Build check handler increments buildTries and, on the third attempt,
  // reveals the full line (buildShown) — one handler shared by learner and
  // Authored_Content sessions (no learner-specific Build logic).
  assert.match(html, /S\.buildTries\+\+/);
  assert.match(html, /if \(S\.buildTries >= 3\)\{\s*S\.buildShown=true;\s*S\.built=chunk\(conv\(\)\.turns\[at\]\[1\]\);/);
  // "N tries left." messaging and the reveal copy are the existing shared UI.
  assert.match(html, /3 - S\.buildTries/);
  assert.match(html, /Three tries is plenty/);
  // Moving to the next line resets the attempt/reveal state the same way.
  assert.match(html, /S\.built=\[\];\s*S\.checked=false;\s*S\.buildTries=0;\s*S\.buildShown=false;/);
});

// ===========================================================================
// Scene — five-part layout + neutral default for reference-poor content (7.3/7.4)
// ===========================================================================

test("the Scene renders via the single five-part sceneHTML layout for both sources (Req 7.4)", () => {
  const html = readHost();
  // One sceneHTML renders all five parts; scene() feeds it the BuiltSession scene
  // for a learner session and SCENE for Authored_Content — same five-part layout.
  assert.match(html, /const sceneHTML\s*=\s*\(\)\s*=>/);
  assert.match(html, /scene\(\)\s*:\s*SCENE|learnerActive\(\)\s*\?\s*S\.learnerSession\.scene\s*:\s*SCENE/);
  for (const label of ["You are", "Talking to", "You want", "Going well when"]) {
    assert.ok(html.includes(label), `sceneHTML should render the "${label}" part`);
  }
});

test("reference-poor learner content yields the neutral default five-part Scene (Req 7.3)", () => {
  // Even reference-poor content gets a complete, non-empty five-part Scene whose
  // success condition is "keep the conversation going" (the neutral default).
  const scene = buildScene([line({ fr: "Bon.", index: 0 })]);
  for (const part of ["where", "you", "them", "want", "done"]) {
    assert.equal(typeof scene[part], "string");
    assert.ok(scene[part].length > 0, `Scene.${part} should be non-empty`);
  }
  assert.match(scene.done.toLowerCase(), /conversation going/);
});

test("no Scene part copies or translates learner French (Req 7.5 — app-authored English)", () => {
  const lines = sampleLines();
  const scene = buildExercises(lines).scene;
  for (const part of Object.values(scene)) {
    for (const l of lines) {
      assert.ok(!part.includes(l.fr), "a Scene part must not contain learner French");
    }
  }
});

// ===========================================================================
// Done — empty-session message, no fabricated evidence (Req 9.5)
// ===========================================================================

test("the Done screen shows a plain-English empty-session message, no fabricated evidence (Req 9.5)", () => {
  const html = readHost();
  // The empty-session branch fires for a learner session with no attempts and no
  // written sentences, showing a plain-English message rather than empty sections
  // or invented evidence.
  assert.match(html, /learnerActive\(\)\s*&&\s*S\.said\.length\s*===\s*0\s*&&\s*mine\.length\s*===\s*0/);
  assert.match(html, /No sentences were kept this session/i);
  // It still offers the restart affordance so the learner keeps a working product.
  assert.match(html, /id="restart"/);
});

test("the Done authored French teaser never reaches a learner session (Req 9.5 — no fabricated French)", () => {
  const html = readHost();
  // The authored "franchement/..." teaser is gated behind learnerActive() ? "" :
  // so a learner Done screen shows only the learner's own verbatim material.
  assert.match(html, /learnerActive\(\)\s*\?\s*""\s*:/);
});

// ===========================================================================
// Flow parity + regression (Req 11.1, 11.4, 11.5)
// ===========================================================================

test("the learner-built flow advances in the same six-step order as Authored_Content (Req 11.1)", () => {
  const html = readHost();
  // The flow order constant is shared; a learner session advances through the
  // same Set up → Choose → Read → Build → Say it → Done sequence.
  assert.match(html, /const ORDER = \["start","pick","read","build","say","done"\]/);
  // The screen table maps each state to one renderer, used by both sources.
  assert.match(html, /start:screenStart,\s*pick:screenPick,\s*read:screenRead/);
  assert.match(html, /build:screenBuild,\s*say:screenSay,\s*done:screenDone/);
});

test("word-card example gathering also includes learner Source_Lines, origin-labelled (Req 11.4)", () => {
  const lines = sampleLines();
  const cards = selectWordCards(lines);
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

test("Authored_Content word-card example gathering is left unchanged (Req 11.4 regression)", () => {
  const html = readHost();
  // usesOf() still scans ALL authored WEEKENDS for verbatim uses for an
  // Authored_Content session — the learner extension does not alter that branch.
  assert.match(html, /Object\.entries\(WEEKENDS\)\.forEach/);
  assert.match(html, /fr\.toLowerCase\(\)\.includes\(phrase\.toLowerCase\(\)\)/);
});

test("every French string the routed session renders is verbatim learner material (Req 11.* / Property 1)", () => {
  const lines = sampleLines();
  const s = buildExercises(lines);
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

test("the host renders only learner-facing labels, never internal/provenance identifiers (Req 11.5)", () => {
  const html = readHost();
  // On-screen speaker labels come from speakerName(); learner-session copy is
  // learner-facing English ("Your conversation"), not internal field/component
  // or provenance names.
  assert.match(html, /function\s+speakerName\s*\(/);
  assert.match(html, />Your conversation</);
  for (const internal of ["provenance:\"learner\"", "Source_Line<", "WordCardMap", "BuiltSession"]) {
    assert.ok(!html.includes(">" + internal), `internal name should not be rendered: ${internal}`);
  }
});

// ===========================================================================
// Privacy / persistence — local-only writes, cleared storage = first-run (12.2/12.5)
// ===========================================================================

test("the host persists accepted Learner_Content only via local-only saveLearnerContent (Req 12.2)", () => {
  const html = readHost();
  // Accepting an import writes the Source_Lines through saveLearnerContent, whose
  // only sink is client-side local storage (no account / network / cross-device).
  assert.match(html, /bridge\.saveLearnerContent\(result\.sourceLines\)/);
  assert.match(html, /bridge\.saveLearnerContent\(lines\)/);
  // First-run hydration reads back through loadLearnerContent — again local only.
  assert.match(html, /function\s+hydrateLearnerContent\s*\(/);
  assert.match(html, /loadLearnerContent/);
});

test("saveLearnerContent writes only to the local storage backend (no network, Req 12.2)", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = () => {
    fetchCalled = true;
    return Promise.reject(new Error("persistence must not use the network"));
  };
  try {
    const store = makeMemoryStorage();
    const lines = sampleLines();
    assert.equal(saveLearnerContent(lines, store), true);

    // The content lives under exactly the one namespaced local-storage key.
    const raw = store._raw();
    assert.deepEqual(Object.keys(raw), [STORAGE_KEY]);
    const envelope = JSON.parse(raw[STORAGE_KEY]);
    assert.equal(envelope.version, STORAGE_VERSION);
    assert.deepEqual(envelope.sourceLines, lines);

    // No network request was made to persist it.
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cleared storage yields first-run behavior that offers the Authored path (Req 12.5)", () => {
  const store = makeMemoryStorage();
  const lines = sampleLines();
  // Save then clear (as the learner clearing site data would).
  saveLearnerContent(lines, store);
  assert.deepEqual(loadLearnerContent(store), lines);
  store.removeItem(STORAGE_KEY);

  // Next launch reads first-run: null => the caller runs on Authored_Content.
  assert.equal(loadLearnerContent(store), null);

  const html = readHost();
  // The host's first-run fallback data (Authored_Content WEEKENDS) and the
  // "Use ours" Authored path are present for exactly this empty state.
  assert.match(html, /const WEEKENDS\s*=/);
  assert.match(html, /data-src="ours"/);
});
