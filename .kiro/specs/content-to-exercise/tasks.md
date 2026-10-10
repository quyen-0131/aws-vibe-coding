# Implementation Plan: Content-to-Exercise Generation

## Overview

This plan implements two new client-side components — **Content_Importer** and **Exercise_Builder** —
as pure functions that transform learner-supplied French into the four data shapes the existing
Read/Build/Say-it/Done screens already consume (`turns`, `PHRASES`, `SCENE`, chip pools).

The implementation proceeds bottom-up: first the data types and the master no-invented-French
containment helper, then the Content_Importer (provenance-in), then each Exercise_Builder transform
(shape-out), then the matcher adapter, persistence, and finally the wiring into the existing flow and
render layer. Property-based tests (fast-check, JavaScript) are written next to each transform to
catch invariant violations early. Each step builds on the previous and ends integrated — no orphaned
code.

All code is JavaScript (matching the existing `weekend-mission-prototype.html` / `server.js`
prototype). Property tests use **fast-check**; each runs a minimum of 100 iterations and is tagged
`Feature: content-to-exercise, Property <number>: <property text>`.

## Tasks

- [x] 1. Set up module structure, shared types, and the containment helper
  - Create a `content-to-exercise/` source module (e.g. `src/content-to-exercise/`) with files for
    `types`, `importer`, `builder`, `matcher-adapter`, `persistence`, and an `index` barrel
  - Define the `SourceLine`, `Turn`, `WordCard`, `WordCardMap`, `Scene`, `Pool`, and `Verdict`
    shapes as described in the design Data Models section (JSDoc typedefs)
  - Implement a shared `isVerbatimSliceOf(frString, sourceLines)` containment helper that returns
    true only when `frString` is an exact character-for-character substring of some Source_Line `fr`
    (accents/casing/contractions preserved); this helper backs Property 1 and is reused by the
    builder transforms
  - Set up the fast-check test harness and add a reusable **Learner_Content generator** (multi-line
    French-ish text with accents, contractions, terminators `. ! ? …`, line breaks, optional speaker
    prefixes `Label:` / `Label-`, and degenerate labels) plus an **edge-input generator**
    (empty/whitespace, single-sentence, over-5,000-char, non-Latin-only)
  - _Requirements: 11.2, 10.1_

- [x] 2. Implement Content_Importer (provenance-in)
  - [x] 2.1 Implement segmentation, trimming, and provenance stamping
    - Split input on sentence-ending punctuation (`.`, `!`, `?`, `…`) and explicit line breaks,
      preserving order; trim outer whitespace only, leaving internal characters/accents/contractions
      unchanged; discard whitespace-only segments; stamp `provenance:"learner"` and a 0-based `index`
      on every Source_Line
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 10.4_

  - [x] 2.2 Implement speaker attribution and the 5,000-character cap
    - Detect a leading label of 1–20 non-separator characters followed by `:` or `-` and attribute
      the remainder to that speaker; empty/whitespace/separator-only label ⇒ unattributed
      (`speaker === null`); when no line is speaker-prefixed, attribute all lines to a single default
      learner speaker; enforce the 5,000-character cap by keeping only leading 5,000 chars and setting
      `truncated:true` (never silent)
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [x] 2.3 Implement the decline/warn result path with input preservation
    - Return `{ok:false, reason:"empty"}` for empty/whitespace; `{ok:false, reason:"too_few",
      sourceLineCount}` for fewer than 2 Source_Lines; `{ok:false, reason:"not_french",
      requiresConfirmation:true}` when no French-relevant characters are present; always echo
      `preservedText === rawText`; all messages plain English
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 2.4 Write property test — Source_Lines non-empty and outer-trimmed
    - **Property 2: Source_Lines are non-empty and outer-trimmed**
    - **Validates: Requirements 2.5, 2.6**

  - [ ]* 2.5 Write property test — provenance stamped on every Source_Line
    - **Property 3: Provenance is stamped on every Source_Line**
    - **Validates: Requirements 2.4**

  - [ ]* 2.6 Write property test — input length cap with honest truncation
    - **Property 4: Input length cap with honest truncation**
    - **Validates: Requirements 1.6**

  - [ ]* 2.7 Write property test — speaker attribution
    - **Property 5: Speaker attribution (label/unattributed/default cases)**
    - **Validates: Requirements 1.3, 1.4, 1.5**

  - [ ]* 2.8 Write property test — formatting-tolerant acceptance
    - **Property 6: Formatting-tolerant acceptance**
    - **Validates: Requirements 1.2**

  - [ ]* 2.9 Write property test — reject path reports honestly and preserves input
    - **Property 7: Reject path reports honestly and preserves input**
    - **Validates: Requirements 3.2, 3.4**

  - [ ]* 2.10 Write unit tests for Content_Importer boundaries
    - A known speaker-prefixed dialogue parsed into expected Source_Lines; the exact 5,000-character
      boundary case; empty-input decline message
    - _Requirements: 1.3, 1.6, 3.1_

- [x] 3. Checkpoint - Importer verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Exercise_Builder transcript and word-card transforms (shape-out)
  - [x] 4.1 Implement `buildTranscript`
    - Produce one `Turn` `[speaker, fr, en]` per Source_Line in order; `fr` verbatim; `en` is the
      learner-supplied English for that line or `""`; never invent a translation
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 4.2 Implement `selectWordCards`
    - Select 1–12 candidate phrases, each occurring verbatim in ≥1 Source_Line; set `phrase` to exact
      text; attach 1–3 examples drawn verbatim from Source_Lines labelled with origin (speaker +
      position); set `en`/`note` to `null` when the learner supplied no gloss; produce zero cards
      rather than fabricate
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

  - [ ]* 4.3 Write property test — transcript shape, order, and English handling
    - **Property 8: Transcript shape, order, and English handling**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 4.4 Write property test — word-card selection bounded, verbatim, gloss-honest
    - **Property 9: Word-card selection is bounded, verbatim, and gloss-honest**
    - **Validates: Requirements 5.1, 5.3, 5.5**

- [x] 5. Implement Exercise_Builder chunk, pool, and scene transforms
  - [x] 5.1 Implement `chunksOf` reusing the existing `chunk()` splitter
    - Reuse the prototype's `chunk(sentence)` splitter unchanged (split on `(?<=[,.!?…])\s+`, group
      into 2–3 word pieces) to produce verbatim target Chunks for a Source_Line
    - _Requirements: 6.1_

  - [x] 5.2 Implement `buildPool` (decoys from other Source_Lines only)
    - Target Chunks from the selected Source_Line; decoys drawn only from *other* Source_Lines in the
      same Learner_Content; exclude any decoy whose trimmed, case-sensitive, accent-preserving text
      equals a target Chunk; include 0–4 decoys so `pool.length <= target.length + 4`; when no other
      Source_Line exists, pool equals target Chunks alone with zero decoys (no Authored/generated
      French)
    - _Requirements: 6.2, 6.3, 6.4, 6.6_

  - [x] 5.3 Implement `buildScene` (English only, neutral default fallback)
    - Produce five non-empty English Scene parts (`where`, `you`, `them`, `want`, `done`); if the five
      parts cannot be populated from concrete references, emit a neutral default Scene whose success
      condition is "keep the conversation going"; never copy or translate Learner_Content French into
      the Scene
    - _Requirements: 7.1, 7.2, 7.5_

  - [x] 5.4 Implement `buildExercises` aggregator producing the existing shapes
    - Compose `transcript`, `wordCards`, `scene`, and `buildFor(index)` into a `BuiltSession` matching
      the shapes the existing Read/Build/Say-it/Done screens consume (no learner-built-specific render
      path)
    - _Requirements: 11.2_

  - [ ]* 5.5 Write property test — chunking reconstructs the line from verbatim slices
    - **Property 10: Chunking reconstructs the line from verbatim slices**
    - **Validates: Requirements 6.1**

  - [ ]* 5.6 Write property test — decoy provenance, exclusion, and pool-size bound
    - **Property 11: Decoy provenance, exclusion, and pool-size bound**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.6**

  - [ ]* 5.7 Write property test — scene is complete and contains no learner French
    - **Property 12: Scene is complete and contains no learner French**
    - **Validates: Requirements 7.1, 7.2, 7.5**

  - [ ]* 5.8 Write property test — builder output conforms to the existing shapes
    - **Property 15: Builder output conforms to the existing shapes**
    - **Validates: Requirements 11.2**

  - [ ]* 5.9 Write the master no-invented-French property test over a full BuiltSession
    - **Property 1: Verbatim French — the no-invented-French master invariant** (reuses the
      `isVerbatimSliceOf` helper as the assertion across transcript turns, word-card phrases/examples,
      target chunks, and decoy chunks)
    - **Validates: Requirements 2.3, 2.5, 4.4, 5.2, 10.1, 10.2, 10.4**

  - [ ]* 5.10 Write unit test for the single-line decoy-free Build case
    - A known single-line input produces a decoy-free pool equal to its target chunks
    - _Requirements: 6.6_

- [x] 6. Checkpoint - Builder verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement the Say-it matcher adapter (reuses existing `judge`)
  - [x] 7.1 Implement `judgeLearnerAttempt`
    - Send `{scene, accepted:[referenceSourceLine], utterance, vocab}` to `POST /api/match`; map the
      response verdict to `{works|thin|missed|not checked}`; coerce unknown verdicts to `not checked`;
      discard any generated French; return the learner's own `referenceSourceLine` labelled as a
      reference; on any unavailability (no key / network / endpoint error / timeout) return
      `not checked` so the learner self-judges and state plainly that feedback is unavailable
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 7.2 Write property test — matcher verdict mapping stays inside the fixed set
    - **Property 13: Matcher verdict mapping stays inside the fixed set** (uses the matcher-response
      generator with in-set/out-of-set verdicts and injected French in `note`/`suggest`/`structure`)
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**

  - [ ]* 7.3 Write integration test against a mocked `/api/match`
    - Verify the request payload shape (8.1) and the four unavailability paths (8.6)
    - _Requirements: 8.1, 8.6_

- [x] 8. Implement local-only persistence
  - [x] 8.1 Implement `saveLearnerContent` / `loadLearnerContent`
    - Store Learner_Content and derived session state in client-side local storage only (no account,
      no cross-device sync); cleared storage ⇒ first-run behavior that offers the Authored_Content
      path; never transmit Learner_Content to any third party for French authoring
    - _Requirements: 12.2, 12.3, 12.5_

  - [x] 8.2 Write property test — Learner_Content stays on-device except in restricted matcher payload
    - **Property 16: Learner_Content never leaves the device except in the restricted matcher payload**
      (assert no network request carries Learner_Content during import/build; assert the matcher body
      contains only attempt, single reference, scene, vocab)
    - **Validates: Requirements 12.1, 12.3, 12.4**

- [x] 9. Wire learner-built sessions into the existing flow and render layer
  - [x] 9.1 Add the importer UI and empty-state handling
    - Present a text input that accepts pasted plain text; on decline/warn, preserve the typed text and
      keep the Authored_Content path available; run fully on Authored_Content when no Learner_Content
      exists
    - _Requirements: 1.1, 3.5, 11.3_

  - [x] 9.2 Route a BuiltSession through Read, Build, Say-it, and Done screens
    - Feed `transcript`, `wordCards`, `scene`, and `buildFor` into the existing screens using the same
      tappable word-card affordance and English toggle; empty-English toggle shows a plain-English "no
      translation" note; Build keeps the existing up-to-three-attempts/reveal behavior; Scene uses the
      five-part layout with the neutral default for reference-poor content; advance Set up → Choose →
      Read → Build → Say it → Done in the same order; show only learner-facing labels (no internal
      field/component/provenance names); extend word-card example gathering to include learner
      Source_Lines while leaving Authored_Content examples unchanged
    - _Requirements: 4.3, 4.5, 5.4, 6.5, 7.3, 7.4, 10.3, 11.1, 11.4, 11.5_

  - [x] 9.3 Build the Done screen from learner content
    - Pair each submitted attempt with the reference Source_Line recorded for that attempt's exercise
      identity; show tapped/saved Word_Card phrases and the learner's own attempt sentences, all French
      verbatim; show no score/fraction/percentage/count/level/streak and no System-generated French;
      show a plain-English "no sentences kept this session" message on an empty session
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 9.4 Enforce the degraded-form fallback when a step would require invented French
    - When a transform cannot complete without inventing French, emit its defined degraded form (zero
      Word_Cards, decoy-free Build, neutral default Scene), leave recorded learner material unchanged,
      and surface a plain-English reason — never fabricate French to avoid an empty result
    - _Requirements: 10.5_

  - [x] 9.5 Write property test — Done screen pairs honestly and shows no scores
    - **Property 14: Done screen pairs honestly and shows no scores**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [x] 9.6 Write example/integration tests for render parity and privacy
    - Read renders learner transcript with the shared word-card affordance and English toggle (4.3,
      4.5); word-card gloss/note render in the English region labelled as the app's (5.4);
      zero-candidate input yields zero cards (5.6); Build uses existing attempts/reveal (6.5); Scene
      renders via the five-part layout with neutral default for reference-poor content (7.3, 7.4);
      Done empty-session message with no fabricated evidence (9.5); learner-built flow advances in the
      same order and Authored_Content regression unchanged (11.1, 11.4, 11.5); Learner_Content writes
      only to local storage and cleared storage yields first-run behavior offering the Authored path
      (12.2, 12.5)
    - _Requirements: 4.3, 4.5, 5.4, 5.6, 6.5, 7.3, 7.4, 9.5, 11.1, 11.4, 11.5, 12.2, 12.5_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP.
- Each task references specific requirements (granular sub-requirements) for traceability.
- Checkpoints ensure incremental validation after the Importer and Builder are complete.
- All 16 correctness properties from the design are mapped to their own property-test sub-tasks,
  each annotated with its property number and the requirements it validates.
- Property tests use fast-check (JavaScript), run a minimum of 100 iterations, and are tagged
  `Feature: content-to-exercise, Property <number>: <property text>`.
- Property 1 (the master no-invented-French invariant) is placed after the builder transforms so it
  can assert over a full `BuiltSession`, reusing the `isVerbatimSliceOf` helper from Task 1.
- Example, snapshot, and integration tests cover UI-parity and flow concerns (1.1, 3.5, 4.3, 4.5,
  5.4, 5.6, 6.5, 7.3, 7.4, 9.5, 11.1, 11.3, 11.4, 11.5, 12.2, 12.5).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "4.1", "4.2", "5.1", "7.1", "8.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "5.2", "5.3", "7.2", "7.3", "8.2"] },
    { "id": 5, "tasks": ["5.4", "5.5", "5.6", "5.7", "5.10"] },
    { "id": 6, "tasks": ["5.8", "5.9", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.4"] },
    { "id": 8, "tasks": ["9.3"] },
    { "id": 9, "tasks": ["9.5", "9.6"] }
  ]
}
```
