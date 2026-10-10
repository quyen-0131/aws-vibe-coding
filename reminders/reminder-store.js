// reminder-store.js — persistence layer for goal-linked reminders.
//
// Reads/writes a single versioned localStorage blob:
//   { goal, targetDate, weeklyTarget, push, lastReminderAt, touches }
//
// Deliberately holds NO attendance fields (no streak/lastOpened/
// sessionsThisWeek/missedCount) — that absence is the anti-streak guarantee
// (design Property 1, Requirement 6.2).
//
// Design notes:
// - Backed by a single namespaced localStorage key holding a JSON blob.
// - Safe in a non-browser (Node test) environment: all storage access is
//   guarded, and a storage reference can be injected via `setStorage()` for
//   unit testing. When no storage is available, the module behaves as a
//   first-run learner and never throws (Requirement 7.3).

// Namespaced, versioned key. Bumping the version invalidates old blobs.
export const STORAGE_KEY = 'lsp.reminders.v1';

// Weekly target bounds (Requirement 2.2).
const MIN_WEEKLY_TARGET = 1;
const MAX_WEEKLY_TARGET = 7;
const DEFAULT_WEEKLY_TARGET = 3;

// Two-touch cap per item (Requirement 5.5).
const MAX_TOUCHES = 2;

// Valid push preference values (design Data Models).
const PUSH_PREFS = new Set(['unset', 'granted', 'denied', 'unsupported']);

/**
 * The storage backend. In a browser this defaults to `localStorage`; in a
 * non-browser environment it is `null` until injected. Kept swappable so unit
 * tests can supply an in-memory stand-in (task 3).
 */
let storage = resolveDefaultStorage();

function resolveDefaultStorage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      return localStorage;
    }
  } catch {
    // Accessing localStorage can throw (e.g. disabled/sandboxed). Treat as
    // unavailable and fall back to first-run behavior.
  }
  return null;
}

/**
 * Inject or replace the storage backend. Pass a Web Storage-like object
 * (with getItem/setItem) or `null` to simulate an unavailable store.
 * Intended for unit tests and for re-detecting storage after environment setup.
 * @param {{ getItem: Function, setItem: Function, removeItem?: Function }|null} next
 */
export function setStorage(next) {
  storage = next ?? null;
}

/**
 * First-run defaults: no goal, no target date, weekly target 3, push unset,
 * no prior reminder, no touches. (Requirement 2.1, 7.3.)
 * Returns a fresh object each call so callers cannot mutate shared state.
 * @returns {ReminderState}
 */
export function firstRunDefaults() {
  return {
    goal: '',
    targetDate: null,
    weeklyTarget: DEFAULT_WEEKLY_TARGET,
    push: 'unset',
    lastReminderAt: null,
    touches: {},
  };
}

/**
 * Coerce an arbitrary parsed value into a valid ReminderState, filling any
 * missing/invalid field from defaults. This makes loadState resilient to
 * partially-corrupt or older-shaped blobs (Requirement 7.3) and guarantees
 * that no forbidden attendance field is carried through — only known fields
 * are copied.
 * @param {unknown} raw
 * @returns {ReminderState}
 */
function normalizeState(raw) {
  const defaults = firstRunDefaults();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const state = defaults;

  if (typeof raw.goal === 'string') {
    state.goal = raw.goal;
  }

  if (typeof raw.targetDate === 'string' && raw.targetDate) {
    state.targetDate = raw.targetDate;
  } else {
    state.targetDate = null;
  }

  if (typeof raw.weeklyTarget === 'number' && Number.isFinite(raw.weeklyTarget)) {
    state.weeklyTarget = clampWeeklyTarget(raw.weeklyTarget);
  }

  if (typeof raw.push === 'string' && PUSH_PREFS.has(raw.push)) {
    state.push = raw.push;
  }

  if (typeof raw.lastReminderAt === 'number' && Number.isFinite(raw.lastReminderAt)) {
    state.lastReminderAt = raw.lastReminderAt;
  } else {
    state.lastReminderAt = null;
  }

  // touches: only keep non-negative integer counts keyed by string ids.
  if (raw.touches && typeof raw.touches === 'object') {
    const touches = {};
    for (const [itemId, count] of Object.entries(raw.touches)) {
      if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
        touches[itemId] = Math.floor(count);
      }
    }
    state.touches = touches;
  }

  return state;
}

/**
 * Load the persisted reminder state. On any failure — storage unavailable,
 * missing blob, JSON parse error, or corrupt shape — returns first-run
 * defaults rather than throwing (Requirement 7.3, design Error Handling).
 * @returns {ReminderState}
 */
export function loadState() {
  if (!storage) {
    return firstRunDefaults();
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw == null) {
      return firstRunDefaults();
    }
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    // Corrupt blob or storage read error: behave as first-run (never crash).
    return firstRunDefaults();
  }
}

/**
 * Persist the given state. Swallows storage errors (e.g. quota, disabled
 * storage) so callers are never interrupted; when storage is unavailable the
 * write is silently a no-op and the session runs on in-memory state.
 * @param {ReminderState} state
 */
function persist(state) {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable/full: behave gracefully, say nothing alarming.
  }
}

/**
 * Clamp a weekly target into the allowed [1,7] range (Requirement 2.2,
 * Property 6). Non-numeric input falls back to the default.
 * @param {number} n
 * @returns {number}
 */
export function clampWeeklyTarget(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    return DEFAULT_WEEKLY_TARGET;
  }
  const rounded = Math.round(n);
  if (rounded < MIN_WEEKLY_TARGET) return MIN_WEEKLY_TARGET;
  if (rounded > MAX_WEEKLY_TARGET) return MAX_WEEKLY_TARGET;
  return rounded;
}

/**
 * Save the goal text and optional target date (Requirement 1.3, 1.5, 7.1).
 * `text` may be "" (a learner can clear the wording while keeping settings).
 * `date` is optional; pass a yyyy-mm-dd string, or null/undefined for none.
 * @param {string} text
 * @param {string|null} [date]
 */
export function saveGoal(text, date) {
  const state = loadState();
  state.goal = typeof text === 'string' ? text : '';
  state.targetDate = typeof date === 'string' && date ? date : null;
  persist(state);
}

/**
 * Clear the goal and its target date, leaving cadence/push untouched
 * (Requirement 1.5).
 */
export function clearGoal() {
  const state = loadState();
  state.goal = '';
  state.targetDate = null;
  persist(state);
}

/**
 * Set the weekly reminder target, clamped to [1,7] (Requirement 2.2, 2.3).
 * @param {number} n
 */
export function setWeeklyTarget(n) {
  const state = loadState();
  state.weeklyTarget = clampWeeklyTarget(n);
  persist(state);
}

/**
 * Set the push permission preference (Requirement 7.1). Unknown values are
 * ignored to keep the persisted enum valid.
 * @param {"unset"|"granted"|"denied"|"unsupported"} pref
 */
export function setPushPref(pref) {
  if (!PUSH_PREFS.has(pref)) {
    return;
  }
  const state = loadState();
  state.push = pref;
  persist(state);
}

/**
 * Record when the last reminder was offered (Requirement 6.1, "quiet
 * reschedule"). This is the ONLY field that changes when a reminder is not
 * acted on — there is deliberately no miss/streak/penalty counterpart. It
 * records a moment in time (epoch ms), never a count of attendance, so it
 * cannot become the streak the product rejects (design Property 1/2).
 *
 * Non-finite input is clamped to `null` (no reminder recorded) rather than
 * persisting garbage. Adds no other field to the blob.
 * @param {number|null} ts epoch ms of the reminder just offered, or null
 */
export function setLastReminderAt(ts) {
  const state = loadState();
  state.lastReminderAt =
    typeof ts === 'number' && Number.isFinite(ts) ? ts : null;
  persist(state);
}

/**
 * Record a notification touch for an item, incrementing its count but never
 * exceeding the two-touch cap (Requirement 5.5, Property 7).
 * @param {string} itemId
 */
export function recordTouch(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return;
  }
  const state = loadState();
  const current = state.touches[itemId] ?? 0;
  state.touches[itemId] = Math.min(current + 1, MAX_TOUCHES);
  persist(state);
}

/**
 * @typedef {Object} ReminderState
 * @property {string} goal            "" if none
 * @property {string|null} targetDate ISO date yyyy-mm-dd, no time; null if none
 * @property {number} weeklyTarget    1..7, default 3
 * @property {"unset"|"granted"|"denied"|"unsupported"} push
 * @property {number|null} lastReminderAt epoch ms of last reminder offered
 * @property {{ [itemId: string]: number }} touches sends per next-thing, cap 2
 */
