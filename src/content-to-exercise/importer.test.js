// importer.test.js — unit tests for Content_Importer segmentation (Task 2.1).
//
// Scope: segmentation, outer-whitespace trimming, whitespace-only discard, and
// provenance/index stamping (Requirements 2.1–2.6, 10.4). Speaker attribution
// (Task 2.2), the 5,000-char cap (Task 2.2), and the decline/warn path (Task 2.3)
// are tested with their own tasks and are intentionally NOT exercised here.
//
// Uses Node's built-in test runner (node:test), matching the project setup.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  segmentSourceLines,
  attributeSourceLines,
  capInput,
  detectSpeakerPrefix,
  importContent,
  MAX_INPUT_CHARS,
  DEFAULT_SPEAKER,
} from "./importer.js";

// ---------------------------------------------------------------------------
// Segmentation on sentence-ending punctuation (Requirement 2.2) + order (2.1)
// ---------------------------------------------------------------------------

test("splits on each sentence terminator (. ! ? …) and preserves order", () => {
  const lines = segmentSourceLines("Salut. Ça va ! T'as faim ? Oui…");
  assert.deepEqual(
    lines.map((l) => l.fr),
    ["Salut.", "Ça va !", "T'as faim ?", "Oui…"]
  );
});

test("splits on explicit line breaks (LF, CR, CRLF), preserving order", () => {
  const lines = segmentSourceLines("Première ligne\nDeuxième ligne\r\nTroisième ligne\rQuatrième");
  assert.deepEqual(
    lines.map((l) => l.fr),
    ["Première ligne", "Deuxième ligne", "Troisième ligne", "Quatrième"]
  );
});

test("splits on terminators and line breaks together, keeping order", () => {
  const lines = segmentSourceLines("Salut !\nj'ai pas eu le temps. On y va ?");
  assert.deepEqual(
    lines.map((l) => l.fr),
    ["Salut !", "j'ai pas eu le temps.", "On y va ?"]
  );
});

// ---------------------------------------------------------------------------
// Outer-trim only; internal characters/accents/contractions unchanged (2.3,2.5,10.4)
// ---------------------------------------------------------------------------

test("trims only outer whitespace, leaving internal characters intact", () => {
  const lines = segmentSourceLines("   on s'est baladés  le long de la rivière.   ");
  assert.equal(lines.length, 1);
  // Outer whitespace gone; the double space INSIDE the sentence is preserved.
  assert.equal(lines[0].fr, "on s'est baladés  le long de la rivière.");
});

test("preserves accents and casual-French contractions verbatim", () => {
  const lines = segmentSourceLines("T'as passé un bon week-end ? Ô là là, j'étais crevé…");
  assert.deepEqual(
    lines.map((l) => l.fr),
    ["T'as passé un bon week-end ?", "Ô là là, j'étais crevé…"]
  );
});

// ---------------------------------------------------------------------------
// Discard whitespace-only segments (Requirement 2.6)
// ---------------------------------------------------------------------------

test("discards whitespace-only segments rather than producing empty lines", () => {
  const lines = segmentSourceLines("\n\n  Salut.  \n\n\t\n  Ça va ?  \n");
  assert.deepEqual(
    lines.map((l) => l.fr),
    ["Salut.", "Ça va ?"]
  );
});

test("empty and whitespace-only input yields zero Source_Lines", () => {
  assert.deepEqual(segmentSourceLines(""), []);
  assert.deepEqual(segmentSourceLines("   \n\t  \n"), []);
});

test("defensive against non-string input", () => {
  assert.deepEqual(segmentSourceLines(null), []);
  assert.deepEqual(segmentSourceLines(undefined), []);
  assert.deepEqual(segmentSourceLines(42), []);
});

// ---------------------------------------------------------------------------
// Provenance + 0-based index stamping (Requirement 2.4)
// ---------------------------------------------------------------------------

test("stamps provenance 'learner' and a 0-based contiguous index on every line", () => {
  const lines = segmentSourceLines("Un. Deux. Trois.");
  assert.equal(lines.length, 3);
  lines.forEach((line, i) => {
    assert.equal(line.provenance, "learner");
    assert.equal(line.index, i);
  });
});

test("index reflects surviving lines after whitespace-only segments are dropped", () => {
  // Blank segments between real sentences must not leave gaps in the index.
  const lines = segmentSourceLines("Un.\n\n\n   \nDeux.\n   \nTrois.");
  assert.deepEqual(
    lines.map((l) => l.index),
    [0, 1, 2]
  );
  assert.deepEqual(
    lines.map((l) => l.fr),
    ["Un.", "Deux.", "Trois."]
  );
});

test("every produced Source_Line fr is non-empty and outer-trimmed", () => {
  const lines = segmentSourceLines("  Salut !  \n   \n  Ça va ?  ");
  for (const line of lines) {
    assert.ok(line.fr.length > 0, "fr must be non-empty");
    assert.equal(line.fr, line.fr.trim(), "fr must be outer-trimmed");
  }
});

// ===========================================================================
// Task 2.2 — speaker attribution and the 5,000-character cap
// ===========================================================================

// ---------------------------------------------------------------------------
// capInput — 5,000-character cap with honest truncation (Requirement 1.6)
// ---------------------------------------------------------------------------

test("capInput passes through input at or under the cap untouched", () => {
  const under = "a".repeat(MAX_INPUT_CHARS - 1);
  assert.deepEqual(capInput(under), { text: under, truncated: false });

  const exact = "b".repeat(MAX_INPUT_CHARS);
  assert.deepEqual(capInput(exact), { text: exact, truncated: false });
});

test("capInput truncates to the leading 5,000 chars and flags truncated:true", () => {
  const over = "c".repeat(MAX_INPUT_CHARS + 250);
  const result = capInput(over);
  assert.equal(result.truncated, true);
  assert.equal(result.text.length, MAX_INPUT_CHARS);
  assert.equal(result.text, over.slice(0, MAX_INPUT_CHARS));
});

test("capInput treats non-string input as empty, never throwing", () => {
  assert.deepEqual(capInput(null), { text: "", truncated: false });
  assert.deepEqual(capInput(undefined), { text: "", truncated: false });
  assert.deepEqual(capInput(123), { text: "", truncated: false });
});

// ---------------------------------------------------------------------------
// detectSpeakerPrefix — label detection and degenerate rejection (1.3, 1.5)
// ---------------------------------------------------------------------------

test("detectSpeakerPrefix reads a label followed by ':' and the remainder", () => {
  assert.deepEqual(detectSpeakerPrefix("Marie: Salut ça va ?"), {
    speaker: "Marie",
    content: " Salut ça va ?",
  });
});

test("detectSpeakerPrefix reads a label followed by '-' and the remainder", () => {
  assert.deepEqual(detectSpeakerPrefix("Paul- T'as faim ?"), {
    speaker: "Paul",
    content: " T'as faim ?",
  });
});

test("detectSpeakerPrefix accepts labels up to 20 chars and rejects 21+", () => {
  const twenty = "A".repeat(20);
  assert.deepEqual(detectSpeakerPrefix(`${twenty}: hi.`), { speaker: twenty, content: " hi." });

  const twentyOne = "A".repeat(21);
  assert.equal(detectSpeakerPrefix(`${twentyOne}: hi.`), null);
});

test("detectSpeakerPrefix rejects degenerate prefixes (empty/separator-only)", () => {
  // Leading separator with no label.
  assert.equal(detectSpeakerPrefix(": bonjour."), null);
  assert.equal(detectSpeakerPrefix("- bonjour."), null);
  assert.equal(detectSpeakerPrefix("-- bonjour."), null);
  // A space before the separator means the label part contains whitespace => reject.
  assert.equal(detectSpeakerPrefix("   : bonjour."), null);
  // A plain sentence with no separator is not prefixed.
  assert.equal(detectSpeakerPrefix("Bonjour tout le monde."), null);
});

// ---------------------------------------------------------------------------
// attributeSourceLines — attribution + cap integration (1.3, 1.4, 1.5, 1.6)
// ---------------------------------------------------------------------------

test("attributes a speaker-prefixed dialogue and strips the prefix from fr", () => {
  const { sourceLines, truncated } = attributeSourceLines(
    "Marie: Salut ! Ça va ?\nPaul- Oui, et toi ?"
  );
  assert.equal(truncated, false);
  assert.deepEqual(
    sourceLines.map((l) => [l.speaker, l.fr]),
    [
      ["Marie", "Salut !"],
      ["Marie", "Ça va ?"],
      ["Paul", "Oui, et toi ?"],
    ]
  );
});

test("no speaker-prefixed line => every line gets the single default speaker", () => {
  const { sourceLines } = attributeSourceLines("Salut. Ça va ? On y va.");
  assert.ok(sourceLines.length >= 2);
  for (const line of sourceLines) {
    assert.equal(line.speaker, DEFAULT_SPEAKER);
  }
});

test("default speaker can be overridden via options", () => {
  const { sourceLines } = attributeSourceLines("Salut. Ça va ?", { defaultSpeaker: "Moi" });
  for (const line of sourceLines) assert.equal(line.speaker, "Moi");
});

test("degenerate-label line stays unattributed (null) when other lines are prefixed", () => {
  const { sourceLines } = attributeSourceLines("Marie: Salut.\n: juste un deux-points.");
  assert.deepEqual(
    sourceLines.map((l) => [l.speaker, l.fr]),
    [
      ["Marie", "Salut."],
      [null, ": juste un deux-points."],
    ]
  );
});

test("attributeSourceLines stamps provenance and contiguous 0-based index", () => {
  const { sourceLines } = attributeSourceLines("Marie: Un.\nPaul: Deux. Trois.");
  sourceLines.forEach((line, i) => {
    assert.equal(line.provenance, "learner");
    assert.equal(line.index, i);
    assert.equal(line.en, "");
  });
  assert.deepEqual(
    sourceLines.map((l) => l.index),
    [0, 1, 2]
  );
});

test("attributeSourceLines applies the 5,000-char cap before attributing", () => {
  // Build input whose first 5,000 chars contain two full sentences and the
  // overflow contains a third that must be dropped.
  const head = "Marie: " + "a".repeat(2000) + ". Paul: " + "b".repeat(2000) + ". ";
  const padding = "x".repeat(MAX_INPUT_CHARS - head.length);
  const tail = ". Jean: cette phrase est au-delà de la limite.";
  const raw = head + padding + tail;
  assert.ok(raw.length > MAX_INPUT_CHARS);

  const { sourceLines, truncated } = attributeSourceLines(raw);
  assert.equal(truncated, true);
  // Nothing from the dropped tail should appear.
  assert.ok(sourceLines.every((l) => !l.fr.includes("au-delà de la limite")));
});

test("exact 5,000-character input is accepted whole (truncated:false)", () => {
  const sentence = "Salut. ";
  let raw = "";
  while (raw.length < MAX_INPUT_CHARS) raw += sentence;
  raw = raw.slice(0, MAX_INPUT_CHARS);
  const { truncated } = attributeSourceLines(raw);
  assert.equal(truncated, false);
});

// ===========================================================================
// Task 2.3 — importContent decline/warn result path (Requirements 3.1–3.4)
// ===========================================================================

// ---------------------------------------------------------------------------
// Empty / whitespace-only input => reason "empty" (Requirement 3.1)
// ---------------------------------------------------------------------------

test("importContent declines empty input with reason 'empty' and plain-English message", () => {
  const result = importContent("");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "empty");
  assert.equal(result.preservedText, "");
  assert.ok(typeof result.message === "string" && result.message.length > 0);
});

test("importContent declines whitespace-only input with reason 'empty' and preserves it verbatim", () => {
  const raw = "   \n\t  \n";
  const result = importContent(raw);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "empty");
  assert.equal(result.preservedText, raw);
  assert.equal(result.sourceLineCount, 0);
});

test("importContent treats non-string input as empty, preserving an empty string", () => {
  const result = importContent(null);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "empty");
  assert.equal(result.preservedText, "");
});

// ---------------------------------------------------------------------------
// Fewer than 2 Source_Lines => reason "too_few" with honest count (Req 3.2)
// ---------------------------------------------------------------------------

test("importContent declines a single Source_Line with reason 'too_few' and count 1", () => {
  const result = importContent("Salut tout le monde.");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "too_few");
  assert.equal(result.sourceLineCount, 1);
  assert.ok(result.message.length > 0);
});

test("importContent reports the honest Source_Line count found", () => {
  // One speaker-prefixed physical line that segments into exactly one sentence.
  const raw = "Marie: Bonjour.";
  const result = importContent(raw);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "too_few");
  assert.equal(result.sourceLineCount, 1);
  assert.equal(result.preservedText, raw);
});

// ---------------------------------------------------------------------------
// No French-relevant characters => reason "not_french" + confirmation (Req 3.3)
// ---------------------------------------------------------------------------

test("importContent warns about non-French input and requires confirmation", () => {
  // Enough sentences to clear "too_few", but no Latin/accented letters at all.
  const raw = "12345. 67890. !!!";
  const result = importContent(raw);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_french");
  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.preservedText, raw);
});

test("importContent accepts French with accents as French-relevant", () => {
  const result = importContent("Salut. Ça va ?");
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// Accepted input => ok:true with sourceLines + truncated (Requirements 3.x happy path)
// ---------------------------------------------------------------------------

test("importContent accepts well-formed input and returns Source_Lines", () => {
  const result = importContent("Salut ! Ça va ? On y va.");
  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.sourceLines));
  assert.ok(result.sourceLines.length >= 2);
  assert.equal(result.truncated, false);
});

test("importContent reports truncation on over-length accepted input", () => {
  const head = "Salut. Ça va ? ";
  const raw = head + "é".repeat(MAX_INPUT_CHARS);
  assert.ok(raw.length > MAX_INPUT_CHARS);
  const result = importContent(raw);
  assert.equal(result.ok, true);
  assert.equal(result.truncated, true);
});

// ---------------------------------------------------------------------------
// preservedText === rawText across every declined/warned case (Requirement 3.4)
// ---------------------------------------------------------------------------

test("importContent echoes preservedText === rawText for every non-ok reason", () => {
  for (const raw of ["   ", "Juste une phrase.", "123. 456. 789."]) {
    const result = importContent(raw);
    assert.equal(result.ok, false);
    assert.equal(result.preservedText, raw);
  }
});
