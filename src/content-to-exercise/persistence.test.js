// persistence.test.js — unit tests for local-only Learner_Content persistence
// (Task 8.1, Requirements 12.2, 12.3, 12.5).
//
// Scope: round-trip save/load through an injected storage backend, first-run
// behavior on cleared/absent/corrupt storage, clearing semantics, graceful
// degradation when no backend exists, and the local-only guarantee (no network).
// Property-based coverage (Property 16) is Task 8.2 and is NOT implemented here.
//
// Uses Node's built-in test runner (node:test), matching the project setup. A
// tiny in-memory Web Storage stand-in lets these run under node where
// `globalThis.localStorage` is absent.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  saveLearnerContent,
  loadLearnerContent,
  STORAGE_KEY,
  STORAGE_VERSION,
} from "./persistence.js";

// A minimal in-memory stand-in for Web Storage, used as an injected backend so
// the pure persistence logic can be exercised under node.
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
    // Test-only helpers (not part of StorageBackend).
    _raw: () => Object.fromEntries(map),
    _has: (k) => map.has(k),
  };
}

const sampleLines = [
  { speaker: "Marie", fr: "Salut !", en: "", provenance: "learner", index: 0 },
  { speaker: "Paul", fr: "Ça va ?", en: "", provenance: "learner", index: 1 },
];

// ---------------------------------------------------------------------------
// Round-trip: save then load returns the same Source_Lines (Requirement 12.2)
// ---------------------------------------------------------------------------

test("saveLearnerContent then loadLearnerContent round-trips the Source_Lines", () => {
  const store = makeMemoryStorage();
  assert.equal(saveLearnerContent(sampleLines, store), true);

  const loaded = loadLearnerContent(store);
  assert.deepEqual(loaded, sampleLines);
});

test("saved payload is a versioned envelope stored under the namespaced key", () => {
  const store = makeMemoryStorage();
  saveLearnerContent(sampleLines, store);

  const rawEntries = store._raw();
  assert.ok(Object.prototype.hasOwnProperty.call(rawEntries, STORAGE_KEY));
  const envelope = JSON.parse(rawEntries[STORAGE_KEY]);
  assert.equal(envelope.version, STORAGE_VERSION);
  assert.deepEqual(envelope.sourceLines, sampleLines);
});

// ---------------------------------------------------------------------------
// First-run behavior on cleared / absent storage (Requirement 12.5)
// ---------------------------------------------------------------------------

test("loadLearnerContent returns null when nothing has been stored (first-run)", () => {
  const store = makeMemoryStorage();
  assert.equal(loadLearnerContent(store), null);
});

test("cleared storage yields first-run: load returns null after the key is gone", () => {
  const store = makeMemoryStorage();
  saveLearnerContent(sampleLines, store);
  assert.deepEqual(loadLearnerContent(store), sampleLines);

  // Simulate the learner clearing local storage.
  store.removeItem(STORAGE_KEY);
  assert.equal(loadLearnerContent(store), null);
});

test("saveLearnerContent(null) clears the store so the next load is first-run", () => {
  const store = makeMemoryStorage();
  saveLearnerContent(sampleLines, store);
  assert.equal(saveLearnerContent(null, store), true);
  assert.equal(store._has(STORAGE_KEY), false);
  assert.equal(loadLearnerContent(store), null);
});

test("saveLearnerContent([]) clears the store (empty content is first-run)", () => {
  const store = makeMemoryStorage();
  saveLearnerContent(sampleLines, store);
  assert.equal(saveLearnerContent([], store), true);
  assert.equal(loadLearnerContent(store), null);
});

// ---------------------------------------------------------------------------
// Robustness: corrupt / stale payloads degrade to first-run, never throw
// ---------------------------------------------------------------------------

test("corrupt JSON in storage is treated as first-run rather than throwing", () => {
  const store = makeMemoryStorage({ [STORAGE_KEY]: "{not valid json" });
  assert.equal(loadLearnerContent(store), null);
});

test("mismatched schema version is treated as first-run", () => {
  const stale = JSON.stringify({ version: STORAGE_VERSION + 1, sourceLines: sampleLines });
  const store = makeMemoryStorage({ [STORAGE_KEY]: stale });
  assert.equal(loadLearnerContent(store), null);
});

test("envelope missing a sourceLines array is treated as first-run", () => {
  const bad = JSON.stringify({ version: STORAGE_VERSION, sourceLines: "nope" });
  const store = makeMemoryStorage({ [STORAGE_KEY]: bad });
  assert.equal(loadLearnerContent(store), null);
});

// ---------------------------------------------------------------------------
// Graceful degradation when no storage backend is available (Node / privacy)
// ---------------------------------------------------------------------------

test("no backend available: save is a safe no-op and load reports first-run", () => {
  // No injected backend and, under node, no globalThis.localStorage.
  assert.equal(typeof globalThis.localStorage, "undefined");
  assert.equal(saveLearnerContent(sampleLines), false);
  assert.equal(loadLearnerContent(), null);
});

test("a backend that throws on access degrades to first-run without throwing", () => {
  const throwing = {
    getItem: () => {
      throw new Error("storage disabled");
    },
    setItem: () => {
      throw new Error("storage disabled");
    },
    removeItem: () => {
      throw new Error("storage disabled");
    },
  };
  // setItem throwing ⇒ save reports false (fail-soft), does not propagate.
  assert.equal(saveLearnerContent(sampleLines, throwing), false);
  // getItem throwing ⇒ load reports first-run.
  assert.equal(loadLearnerContent(throwing), null);
});

// ---------------------------------------------------------------------------
// Local-only guarantee: persistence performs no network I/O (Requirement 12.3)
// ---------------------------------------------------------------------------

test("persistence makes no network request (local-only, Requirement 12.3)", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = () => {
    fetchCalled = true;
    return Promise.reject(new Error("network must not be used by persistence"));
  };
  try {
    const store = makeMemoryStorage();
    saveLearnerContent(sampleLines, store);
    loadLearnerContent(store);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
