// ai-phrases.test.js — the opt-in Gemini phrase picker (Requirement 12.6) and
// the word-card selection fixes it sits beside.
//
// Covers:
//   - wordCardsFromPhrases keeps only phrases found word for word in the text
//     (a model can choose, never invent — Requirement 5.2).
//   - buildExercises uses verified suggestions, else falls back to the local
//     selector.
//   - selectWordCards never picks names, punctuation or lone function words.
//   - the host only calls /api/phrases from the opt-in path.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { buildExercises, selectWordCards, wordCardsFromPhrases, buildPool, chunksOf } from "./builder.js";
import { importContent } from "./importer.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const readHost = () => readFileSync(resolve(HERE, "../../app.html"), "utf8");

const SAMPLE = `Contexte : Deux personnes, Camille et Léa, se rencontrent dans un café à Paris.
Camille : Excuse-moi, cette place est libre ? Il y a beaucoup de monde aujourd'hui !
Léa : Oui, bien sûr ! Assieds-toi.`;
const lines = () => importContent(SAMPLE).sourceLines;

test("suggested phrases found word for word in the text become cards", () => {
  const cards = wordCardsFromPhrases(["beaucoup de monde", "bien sûr"], lines());
  assert.deepEqual(Object.keys(cards), ["beaucoup de monde", "bien sûr"]);
  assert.equal(cards["bien sûr"].en, null);
  assert.ok(cards["bien sûr"].examples.length >= 1);
});

test("invented, altered, or partial-word suggestions are discarded", () => {
  const cards = wordCardsFromPhrases(
    ["bien sur", "il fait beau", "ontexte", "Beaucoup de monde", 42, null, ""],
    lines()
  );
  assert.deepEqual(cards, {});
});

test("at most 12 suggested cards, duplicates dropped", () => {
  const ls = [{ speaker: "A", fr: "un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze", en: "", provenance: "learner", index: 0 },
              { speaker: "B", fr: "Encore une ligne.", en: "", provenance: "learner", index: 1 }];
  const words = ls[0].fr.split(" ");
  const cards = wordCardsFromPhrases([...words, ...words], ls);
  assert.equal(Object.keys(cards).length, 12);
});

test("buildExercises uses verified suggestions, else the local selector", () => {
  const ls = lines();
  assert.deepEqual(Object.keys(buildExercises(ls, { phrases: ["bien sûr"] }).wordCards), ["bien sûr"]);
  assert.deepEqual(buildExercises(ls, { phrases: ["inventé"] }).wordCards, selectWordCards(ls));
  assert.deepEqual(buildExercises(ls).wordCards, selectWordCards(ls));
});

test("local selector skips names, punctuation, and lone function words", () => {
  const phrases = Object.keys(selectWordCards(lines()));
  assert.ok(phrases.length > 0);
  for (const p of phrases) {
    assert.doesNotMatch(p, /Camille|Léa|Paris/, `name in "${p}"`);
    assert.doesNotMatch(p, /^[\s:;,.!?]|[\s:;,.!?]$/, `punctuation edge in "${p}"`);
    assert.ok(!["de", "Il", "et", "un", "se"].includes(p), `function word "${p}"`);
  }
});

test("Build decoys avoid the lines shown as context and come from several lines", () => {
  const fr = [
    "Deux personnes, Camille et Léa, se rencontrent dans un café à Paris.",
    "Elles commencent à discuter de leur vie, de leurs voyages et de leurs projets.",
    "Excuse-moi, cette place est libre ?",
    "Il y a beaucoup de monde aujourd'hui !",
    "Oui, presque tous les jours, j'adore ce café.",
    "Moi aussi, je travaille juste à côté.",
    "Je pensais visiter un musée demain.",
  ];
  const ls = fr.map((f, index) => ({ speaker: "A", fr: f, en: "", provenance: "learner", index }));
  const { target, pool } = buildPool(1, ls);
  const decoys = pool.filter((c) => !target.includes(c));
  assert.equal(decoys.length, 4);
  const from = decoys.map((d) => ls.findIndex((l) => chunksOf(l).includes(d)));
  assert.ok(!from.includes(0), "no decoy from the line shown just above");
  assert.ok(!from.includes(2), "no decoy from the very next line");
  assert.ok(new Set(from).size >= 3, "decoys spread over several lines");
});

test("speaker labels with a French space before the colon are detected", () => {
  const ls = lines();
  assert.deepEqual([...new Set(ls.map((l) => l.speaker))], ["Contexte", "Camille", "Léa"]);
  assert.ok(ls.some((l) => l.fr.startsWith("Excuse-moi")), "hyphenated word is not a speaker");
});

test("app.html: the single Start button imports 'Bring your own' text first", () => {
  const html = readHost();
  assert.doesNotMatch(html, /id="importgo"/, "no separate import button");
  assert.match(html, /on\("begin",\(\)=>\{[\s\S]*?S\.source==="own"[\s\S]*?runImport\(false\)/);
});

test("app.html: Gemini translations are opt-in and always labelled (Req 4.6)", () => {
  const html = readHost();
  assert.match(html, /aiTranslations:null/, "no translations by default");
  assert.match(html, /Gemini translation, may be imperfect/);
  // Learner-provided English wins; the machine translation only fills a gap.
  assert.match(html, /!\(typeof en === "string" && en\.length\) \? aiTranslationFor\(fr\)/);
});

test("the host only calls /api/phrases from the opt-in path (Req 12.6)", () => {
  const html = readHost();
  const calls = html.match(/fetch\("\/api\/phrases"/g) || [];
  assert.equal(calls.length, 1, "exactly one call site");
  // Every call site sits on a line that checks the opt-in tick.
  const callLines = html.split("\n").filter((l) => /requestAiPhrases\(/.test(l) && !/function requestAiPhrases/.test(l));
  assert.ok(callLines.length >= 1);
  const src = html.split("\n");
  for (const l of callLines) {
    const i = src.indexOf(l);
    assert.match(src.slice(Math.max(0, i - 3), i + 1).join("\n"), /S\.aiOptIn/, `unguarded call: ${l.trim()}`);
  }
  assert.match(html, /aiOptIn:false/, "opt-in defaults to off");
});
