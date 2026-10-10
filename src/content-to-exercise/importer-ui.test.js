// importer-ui.test.js — example/integration tests for the importer UI entry
// point and empty-state handling (Task 9.1, Requirements 1.1, 3.5, 11.3).
//
// Task 9.1 wires the pure Content_Importer + local-only persistence into the
// render/host app (`weekend-mission-prototype.html`): it presents a text input
// that accepts pasted plain text (Req 1.1); on decline/warn it preserves the
// typed text and keeps the Authored_Content path available (Req 3.5); and it
// runs fully on Authored_Content when no Learner_Content exists (Req 11.3).
//
// That UI logic lives in the host's classic (non-module) script, which cannot be
// imported here. These tests therefore cover Task 9.1 from the two angles the
// design's Testing Strategy calls for:
//
//   1. Host wiring (structural): the host HTML actually contains the importer UI
//      entry point (a pasted-text input), the module bridge that exposes the
//      pure surface, the feature-detected Authored_Content fallback, and the
//      first-run hydration — i.e. the empty-state path is present and does not
//      depend on Learner_Content.
//   2. Public-contract behavior: the exact guarantees the UI relies on, driven
//      through the public module surface the bridge re-exports — decline/warn
//      echoes the learner's typed text verbatim (Req 3.4/3.5 "preserve typed
//      text"), and cleared/first-run storage reports no Learner_Content so the
//      caller falls back to Authored_Content (Req 11.3 / 12.5).
//
// Uses Node's built-in test runner (node:test), matching the project setup.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { importContent } from "./importer.js";
import { saveLearnerContent, loadLearnerContent } from "./persistence.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// src/content-to-exercise/ -> repo root -> the host prototype.
const HOST_HTML = resolve(HERE, "..", "..", "weekend-mission-prototype.html");

function readHost() {
  return readFileSync(HOST_HTML, "utf8");
}

// A minimal in-memory Web Storage stand-in, matching persistence.test.js, so the
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
  };
}

// --- 1. Host wiring: the importer UI entry point exists (Req 1.1) -----------

test("the host presents a text input that accepts pasted plain text (Req 1.1)", () => {
  const html = readHost();
  // The importer UI renders a <textarea> entry point for pasted text, with an id
  // the classic script reads from. Its presence is the Req 1.1 entry point.
  assert.match(html, /<textarea[^>]*id="importtext"/);
  // And a control that runs the import on what was typed.
  assert.match(html, /id="importgo"/);
});

test("the host bridges the pure importer onto the app and feature-detects it (Req 1.1)", () => {
  const html = readHost();
  // The module bridge imports the pure surface from the feature module...
  assert.match(html, /from ['"]\.\/src\/content-to-exercise\/index\.js['"]/);
  assert.match(html, /window\.ContentToExercise\s*=/);
  // ...and the classic script feature-detects importContent before using it, so
  // a missing bridge never breaks the app (it stays on Authored_Content).
  assert.match(html, /window\.ContentToExercise/);
  assert.match(html, /bridge\.importContent/);
});

// --- 2. Empty-state handling keeps the Authored_Content path (Req 3.5, 11.3) --

test("decline/warn keeps the Authored_Content path available in the host (Req 3.5)", () => {
  const html = readHost();
  // The Authored_Content source ("Use ours") is offered on the Set up screen
  // regardless of import state; the importer note points the learner back to it.
  assert.match(html, /data-src="ours"/);
  assert.match(html, /Use ours/);
});

test("the host runs on Authored_Content when no Learner_Content exists (Req 11.3)", () => {
  const html = readHost();
  // First-run hydration pulls any saved Learner_Content; a null result leaves
  // S.learnerContent null so the app runs fully on Authored_Content (WEEKENDS).
  assert.match(html, /function hydrateLearnerContent\(/);
  assert.match(html, /loadLearnerContent/);
  // The Authored_Content data the empty state falls back to is present.
  assert.match(html, /const WEEKENDS\s*=/);
});

// --- 3. Public-contract behavior the UI relies on ---------------------------

test("decline on empty input preserves the learner's typed text verbatim (Req 3.4/3.5)", () => {
  // The UI keeps whatever the learner typed; the importer echoes it back so the
  // textarea can be restored for editing rather than re-entered.
  const typed = "   \n  "; // whitespace-only -> declined as empty
  const r = importContent(typed);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "empty");
  assert.equal(r.preservedText, typed); // verbatim, byte-for-byte
  assert.equal(typeof r.message, "string");
  assert.ok(r.message.length > 0); // a plain-English message to show
});

test("too_few decline reports the honest count and preserves typed text (Req 3.2/3.5)", () => {
  const typed = "Bonjour."; // a single French Source_Line -> too_few
  const r = importContent(typed);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "too_few");
  assert.equal(r.sourceLineCount, 1);
  assert.equal(r.preservedText, typed);
});

test("not_french warning requires confirmation and preserves typed text (Req 3.3/3.5)", () => {
  const typed = "12345\n67890"; // no French-relevant characters
  const r = importContent(typed);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "not_french");
  assert.equal(r.requiresConfirmation, true);
  assert.equal(r.preservedText, typed);
});

test("cleared / first-run storage yields no Learner_Content, so the app runs on Authored_Content (Req 11.3/12.5)", () => {
  const store = makeMemoryStorage();
  // First run: nothing stored -> null -> caller falls back to Authored_Content.
  assert.equal(loadLearnerContent(store), null);

  // Save then clear: back to first-run (null), the empty-state contract again.
  const lines = [
    { speaker: "You", fr: "Bonjour.", en: "", provenance: "learner", index: 0 },
    { speaker: "You", fr: "Ça va ?", en: "", provenance: "learner", index: 1 },
  ];
  saveLearnerContent(lines, store);
  assert.deepEqual(loadLearnerContent(store), lines);
  saveLearnerContent(null, store); // clear
  assert.equal(loadLearnerContent(store), null);
});
