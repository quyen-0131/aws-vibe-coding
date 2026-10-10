// property16.test.js — property test for on-device Learner_Content (Task 8.2).
//
// Feature: content-to-exercise, Property 16: Learner_Content never leaves the
// device except in the restricted matcher payload.
//
// Property 16 (design.md): For any import-and-build run, no network request is
// made carrying Learner_Content (segmentation, chunking, word-card selection, and
// scene construction are pure and client-side); and for any Say-it attempt, the
// matcher request body contains only the attempt text, the single reference
// Source_Line (`accepted:[reference]`), the Scene framing, and vocab — no other
// Learner_Content.
//
// Validates: Requirements 12.1, 12.3, 12.4.
//
// Uses Node's built-in test runner (node:test + node:assert/strict), matching the
// existing test files. The Learner_Content generator (learnerContentArb) and
// fast-check (`fc`) are reused from the shared test harness. The patched
// `globalThis.fetch` is always restored in a finally block so the global is not
// leaked across tests.

import { test } from "node:test";
import assert from "node:assert/strict";

import { importContent } from "./importer.js";
import {
  buildExercises,
  buildTranscript,
  selectWordCards,
  buildPool,
  buildScene,
  chunksOf,
} from "./builder.js";
import { judgeLearnerAttempt } from "./matcher-adapter.js";
import { learnerContentArb, fc } from "./test-harness.js";

// --- Half A — import + build make NO network request (Requirements 12.1, 12.3) ---
//
// Segmentation, chunking, word-card selection, and scene construction are pure
// client-side transforms. Running the full import + build pipeline must not make
// any network request at all — the no-network assertion is the robust form of
// 12.1/12.3 (no request can carry Learner_Content if no request is made).

test("Property 16A: import + build make no network request", () => {
  const originalFetch = globalThis.fetch;

  try {
    fc.assert(
      fc.property(learnerContentArb(), (rawText) => {
        // Spy that records (and refuses) any network call during import/build.
        let fetchCalls = 0;
        globalThis.fetch = (...args) => {
          fetchCalls++;
          throw new Error(
            `import/build must not make a network request; fetch was called with: ${String(
              args[0]
            )}`
          );
        };

        // Run the full client-side pipeline. The no-network assertion must hold
        // regardless of whether the input imports ok or not.
        const result = importContent(rawText);

        if (result.ok) {
          const sourceLines = result.sourceLines;

          // Exercise the aggregate builder and every pure transform it composes.
          const session = buildExercises(sourceLines);
          buildTranscript(sourceLines);
          selectWordCards(sourceLines);
          buildScene(sourceLines);
          // buildFor / buildPool over every line, plus chunksOf per line.
          for (let i = 0; i < sourceLines.length; i++) {
            session.buildFor(i);
            buildPool(i, sourceLines);
            chunksOf(sourceLines[i]);
          }
        }
        // On !ok there is nothing to build; the no-network assertion still holds.

        assert.equal(
          fetchCalls,
          0,
          "no network request may be made during import/build"
        );
      }),
      { numRuns: 100 }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- Half B — the Say-it matcher body is the restricted payload only (Req 12.4) --
//
// A Say-it attempt is the ONLY place Learner_Content leaves the device, and even
// then only a restricted payload may go: the attempt text, the single reference
// Source_Line (`accepted:[reference]`), the Scene framing, and vocab. No other
// Source_Line's French may appear anywhere in the request body.

test("Property 16B: the Say-it matcher body carries only the restricted payload", async () => {
  const originalFetch = globalThis.fetch;

  try {
    await fc.assert(
      fc.asyncProperty(
        // Only accepted imports have Source_Lines to pick a reference from; a
        // post-filter keeps the input space inside the "has >= 1 line" region.
        learnerContentArb().filter((raw) => {
          const r = importContent(raw);
          return r.ok && r.sourceLines.length >= 1;
        }),
        // Pick which line is the reference (index chosen within range below) and
        // the attempt + vocab the learner sends.
        fc.nat(),
        fc.string(),
        fc.array(fc.string(), { maxLength: 5 }),
        async (rawText, refSelector, utterance, vocab) => {
          const result = importContent(rawText);
          // Guard (the filter guarantees this, but keep the property total).
          if (!result.ok || result.sourceLines.length === 0) return;

          const sourceLines = result.sourceLines;
          const referenceLine =
            sourceLines[refSelector % sourceLines.length];
          const scene = buildScene(sourceLines);

          // Capture the request body sent to /api/match and return a successful
          // response so judgeLearnerAttempt completes with a real verdict.
          let capturedBody = null;
          let fetchCalls = 0;
          globalThis.fetch = async (_url, init) => {
            fetchCalls++;
            capturedBody = init && init.body;
            return {
              ok: true,
              json: async () => ({ verdict: "works", note: "ok" }),
            };
          };

          await judgeLearnerAttempt(
            utterance,
            referenceLine.fr,
            scene,
            vocab
          );

          // The adapter made exactly one request and captured a string body.
          assert.equal(fetchCalls, 1, "exactly one matcher request is made");
          assert.equal(
            typeof capturedBody,
            "string",
            "the request body is a JSON string"
          );

          const body = JSON.parse(capturedBody);

          // --- Structural check: keys are EXACTLY the restricted payload. -----
          // No other Learner_Content field may ride along (Requirement 12.4).
          assert.deepEqual(
            Object.keys(body).sort(),
            ["accepted", "scene", "utterance", "vocab"],
            "matcher body keys must be exactly {accepted, scene, utterance, vocab}"
          );

          // --- accepted: the single reference line, verbatim. -----------------
          assert.ok(
            Array.isArray(body.accepted),
            "accepted must be an array"
          );
          assert.equal(
            body.accepted.length,
            1,
            "accepted must carry exactly one reference Source_Line"
          );
          assert.equal(
            body.accepted[0],
            referenceLine.fr,
            "accepted[0] must be the reference Source_Line, verbatim"
          );

          // --- utterance: exactly the attempt text sent. ----------------------
          assert.equal(
            body.utterance,
            utterance,
            "utterance must equal the attempt text sent"
          );

          // --- vocab: exactly the array passed in. ----------------------------
          assert.deepEqual(
            body.vocab,
            vocab,
            "vocab must equal the array passed in"
          );

          // --- Supporting substring sweep: no OTHER Source_Line's French may
          // appear anywhere in the serialized body. To avoid false positives, we
          // remove the two legitimate French-bearing values from the body text
          // (the reference line via accepted[0], and the attempt via utterance)
          // and the reference line itself from the comparison pool, then assert
          // that no remaining Source_Line `fr` is a substring of what's left.
          const serialized = JSON.stringify(body);
          // Strip the legitimate carriers so a decoy that is coincidentally a
          // substring of the reference or the attempt cannot cause a false hit.
          const residual = serialized
            .split(JSON.stringify(referenceLine.fr))
            .join("")
            .split(JSON.stringify(utterance))
            .join("");

          for (const line of sourceLines) {
            if (line === referenceLine) continue; // the reference is allowed
            if (line.fr === referenceLine.fr) continue; // a duplicate of the ref
            assert.ok(
              !residual.includes(line.fr),
              `no non-reference Source_Line French may leak into the matcher body: ${JSON.stringify(
                line.fr
              )}`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
