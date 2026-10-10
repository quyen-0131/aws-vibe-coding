// persistence.js — local-only persistence for Learner_Content.
//
// Learner_Content and derived session state live in client-side local storage
// only (no account, no cross-device sync). Cleared storage ⇒ first-run behavior
// that offers the Authored_Content path. Learner_Content is never transmitted to
// any third party for French authoring.
//
// Design (Requirement 12.2, 12.3, 12.5):
//   - 12.2: persist to client-side local storage ONLY — no account, no sync, no
//     network. This module touches a Web Storage-like backend and nothing else.
//   - 12.3: Learner_Content is never transmitted to any third party. This module
//     performs zero network I/O; the only persistence sink is the local storage
//     backend passed in or feature-detected from the host environment.
//   - 12.5: when local storage is cleared, `loadLearnerContent()` returns `null`
//     so the next launch behaves as a first-run learner with no imported content
//     and the caller falls back to the Authored_Content path.
//
// Storage backend: the browser provides `globalThis.localStorage`. Node (where
// the tests run) does not, so every function accepts an optional injected
// backend and otherwise feature-detects one. When no backend is available the
// functions degrade gracefully (save is a no-op; load returns `null`) — the same
// observable result as cleared/first-run storage, which keeps the Authored path
// available rather than throwing.

/**
 * @typedef {import("./types.js").SourceLine} SourceLine
 */

/**
 * The minimal Web Storage surface this module relies on. `globalThis.localStorage`
 * satisfies it in the browser; tests can pass a tiny in-memory stand-in.
 *
 * @typedef {Object} StorageBackend
 * @property {(key: string) => (string | null)} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 */

/**
 * The single local-storage key under which Learner_Content and its derived
 * session state are stored. Namespaced to avoid colliding with other app keys.
 */
export const STORAGE_KEY = "content-to-exercise/learner-content";

/**
 * The schema version stamped on the persisted envelope. If the shape ever
 * changes, a bumped version lets `loadLearnerContent` reject stale data as
 * first-run rather than mis-reading it.
 */
export const STORAGE_VERSION = 1;

/**
 * Feature-detect the host's local storage, guarding environments (Node, SSR,
 * privacy modes) where it is absent or throws on access.
 *
 * @returns {StorageBackend | null}  A usable backend, or `null` when none exists.
 */
function detectLocalStorage() {
  try {
    const candidate =
      typeof globalThis !== "undefined" ? globalThis.localStorage : undefined;
    if (
      candidate &&
      typeof candidate.getItem === "function" &&
      typeof candidate.setItem === "function" &&
      typeof candidate.removeItem === "function"
    ) {
      return /** @type {StorageBackend} */ (candidate);
    }
  } catch {
    // Accessing `localStorage` can throw (e.g. disabled cookies / sandboxed
    // iframe). Treat that exactly like "no storage": first-run behavior.
  }
  return null;
}

/**
 * Resolve the storage backend to use: the explicitly injected one if valid,
 * otherwise the feature-detected host storage, otherwise `null`.
 *
 * @param {StorageBackend} [backend]  Optional injected backend (used by tests).
 * @returns {StorageBackend | null}
 */
function resolveBackend(backend) {
  if (
    backend &&
    typeof backend.getItem === "function" &&
    typeof backend.setItem === "function" &&
    typeof backend.removeItem === "function"
  ) {
    return backend;
  }
  return detectLocalStorage();
}

/**
 * Persist Learner_Content (and any derived session state) to client-side local
 * storage only (Requirement 12.2). No network, no account, no sync — the only
 * sink is the local storage backend (Requirement 12.3).
 *
 * Passing `null`/`undefined`/`[]` clears the stored content, so the next
 * `loadLearnerContent()` reports first-run (Requirement 12.5).
 *
 * When no storage backend is available the call is a safe no-op: nothing is
 * persisted and nothing is thrown, which the caller observes as first-run on the
 * next load (the Authored_Content path stays available).
 *
 * @param {SourceLine[] | null | undefined} sourceLines  Learner_Content to store.
 * @param {StorageBackend} [backend]  Optional injected backend (used by tests).
 * @returns {boolean}  `true` when something was written or cleared on a real
 *   backend; `false` when no backend was available (no-op).
 */
export function saveLearnerContent(sourceLines, backend) {
  const store = resolveBackend(backend);
  if (!store) return false; // no local storage ⇒ no-op, stays first-run

  // Clearing: empty/absent content removes the key so the next load is first-run.
  if (sourceLines == null || (Array.isArray(sourceLines) && sourceLines.length === 0)) {
    try {
      store.removeItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  const envelope = {
    version: STORAGE_VERSION,
    sourceLines,
  };

  try {
    store.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    // Quota exceeded / serialization failure: fail soft. The learner's in-memory
    // session is unaffected; the next load simply reports first-run.
    return false;
  }
}

/**
 * Load previously persisted Learner_Content from client-side local storage.
 *
 * Returns `null` when there is nothing to load — no backend, an empty/cleared
 * store, malformed JSON, or a mismatched schema version. A `null` result is the
 * first-run signal (Requirement 12.5): the caller offers the Authored_Content
 * path and behaves as a learner with no imported content.
 *
 * @param {StorageBackend} [backend]  Optional injected backend (used by tests).
 * @returns {SourceLine[] | null}  The stored Source_Lines, or `null` for first-run.
 */
export function loadLearnerContent(backend) {
  const store = resolveBackend(backend);
  if (!store) return null; // no local storage ⇒ first-run

  let raw;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw == null || raw === "") return null; // cleared ⇒ first-run

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // corrupt payload ⇒ treat as first-run rather than crash
  }

  // Validate the envelope shape and version before trusting it.
  if (
    !parsed ||
    typeof parsed !== "object" ||
    parsed.version !== STORAGE_VERSION ||
    !Array.isArray(parsed.sourceLines)
  ) {
    return null;
  }

  return /** @type {SourceLine[]} */ (parsed.sourceLines);
}
