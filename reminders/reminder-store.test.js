// reminder-store.test.js — unit tests for the goal-linked reminder store.
//
// Uses Node's built-in test runner (node:test) and assertions (node:assert),
// no new npm dependency. Matches the `reminders/**/*.test.js` glob used by
// `npm test`.
//
// Coverage:
//  - firstRunDefaults() shape (Requirement 2.1, 7.3)
//  - weekly-target clamping to [1,7] (Requirement 2.2, Property 6)
//  - corrupt-blob / wrong-shape reset to defaults (Requirement 7.3)
//  - storage unavailable behaves as first-run and never throws (Requirement 7.3)
//  - persisted shape contains NONE of the forbidden attendance fields
//    (Requirement 6.2, Property 1)
//  - recordTouch caps at 2 per item (Requirement 5.5)
//  - saveGoal / clearGoal round-trip via injected storage

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  STORAGE_KEY,
  setStorage,
  firstRunDefaults,
  loadState,
  saveGoal,
  clearGoal,
  setWeeklyTarget,
  setPushPref,
  recordTouch,
  clampWeeklyTarget,
} from './reminder-store.js';

// The complete set of fields the persisted blob is allowed to contain.
const ALLOWED_FIELDS = [
  'goal',
  'targetDate',
  'weeklyTarget',
  'push',
  'lastReminderAt',
  'touches',
];

// Attendance-derived fields that must NEVER be persisted (the anti-streak
// guarantee — Requirement 6.2, design Property 1).
const FORBIDDEN_FIELDS = [
  'streak',
  'lastOpened',
  'daysInARow',
  'daysActive',
  'sessionsThisWeek',
  'missedCount',
];

/**
 * A minimal in-memory Web Storage stand-in (getItem/setItem/removeItem).
 * A fresh instance is injected before each test so tests stay isolated.
 */
function makeMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    // Test helper: read the raw stored string directly.
    _raw(key) {
      return map.has(key) ? map.get(key) : null;
    },
  };
}

let store;

beforeEach(() => {
  store = makeMemoryStorage();
  setStorage(store);
});

// ---------------------------------------------------------------------------
// firstRunDefaults
// ---------------------------------------------------------------------------

test('firstRunDefaults returns the documented first-run shape', () => {
  const defaults = firstRunDefaults();

  assert.equal(defaults.goal, '');
  assert.equal(defaults.targetDate, null);
  assert.equal(defaults.weeklyTarget, 3);
  assert.equal(defaults.push, 'unset');
  assert.equal(defaults.lastReminderAt, null);
  assert.deepEqual(defaults.touches, {});
});

test('firstRunDefaults returns a fresh object each call (no shared mutation)', () => {
  const a = firstRunDefaults();
  const b = firstRunDefaults();
  a.goal = 'mutated';
  a.touches.x = 1;
  assert.equal(b.goal, '');
  assert.deepEqual(b.touches, {});
});

test('loadState with an empty store returns first-run defaults', () => {
  assert.deepEqual(loadState(), firstRunDefaults());
});

// ---------------------------------------------------------------------------
// Weekly-target clamping (Requirement 2.2, Property 6)
// ---------------------------------------------------------------------------

test('setWeeklyTarget clamps below-range to 1', () => {
  setWeeklyTarget(0);
  assert.equal(loadState().weeklyTarget, 1);
});

test('setWeeklyTarget clamps above-range to 7', () => {
  setWeeklyTarget(99);
  assert.equal(loadState().weeklyTarget, 7);
});

test('setWeeklyTarget keeps an in-range value', () => {
  setWeeklyTarget(4);
  assert.equal(loadState().weeklyTarget, 4);
});

test('clampWeeklyTarget handles boundaries, rounding, and non-numeric input', () => {
  // In-range boundaries.
  assert.equal(clampWeeklyTarget(1), 1);
  assert.equal(clampWeeklyTarget(7), 7);
  assert.equal(clampWeeklyTarget(4), 4);
  // Out of range.
  assert.equal(clampWeeklyTarget(0), 1);
  assert.equal(clampWeeklyTarget(-5), 1);
  assert.equal(clampWeeklyTarget(8), 7);
  assert.equal(clampWeeklyTarget(1000), 7);
  // Rounding of fractional values.
  assert.equal(clampWeeklyTarget(3.4), 3);
  assert.equal(clampWeeklyTarget(3.6), 4);
  // Non-numeric / non-finite input falls back to default (3).
  assert.equal(clampWeeklyTarget(NaN), 3);
  assert.equal(clampWeeklyTarget(Infinity), 3); // non-finite -> default
  assert.equal(clampWeeklyTarget(-Infinity), 3); // non-finite -> default
  assert.equal(clampWeeklyTarget('5'), 3);
  assert.equal(clampWeeklyTarget(undefined), 3);
  assert.equal(clampWeeklyTarget(null), 3);
  assert.equal(clampWeeklyTarget({}), 3);
});

// ---------------------------------------------------------------------------
// Corrupt / wrong-shape blob reset (Requirement 7.3)
// ---------------------------------------------------------------------------

test('loadState resets to defaults on invalid JSON, never throws', () => {
  const corrupt = makeMemoryStorage({ [STORAGE_KEY]: '{not valid json' });
  setStorage(corrupt);

  let result;
  assert.doesNotThrow(() => {
    result = loadState();
  });
  assert.deepEqual(result, firstRunDefaults());
});

test('loadState resets to defaults on valid JSON with the wrong shape', () => {
  // A JSON array / primitive is valid JSON but not a state object.
  const wrongShapeArray = makeMemoryStorage({ [STORAGE_KEY]: '[1,2,3]' });
  setStorage(wrongShapeArray);
  assert.deepEqual(loadState(), firstRunDefaults());

  const wrongShapePrimitive = makeMemoryStorage({ [STORAGE_KEY]: '42' });
  setStorage(wrongShapePrimitive);
  assert.deepEqual(loadState(), firstRunDefaults());

  const nullBlob = makeMemoryStorage({ [STORAGE_KEY]: 'null' });
  setStorage(nullBlob);
  assert.deepEqual(loadState(), firstRunDefaults());
});

test('loadState normalizes a partially-corrupt object, filling bad fields from defaults', () => {
  const partial = makeMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      goal: 'Trip to France',
      targetDate: 12345, // wrong type -> null
      weeklyTarget: 99, // out of range -> clamped to 7
      push: 'bogus', // invalid enum -> default 'unset'
      lastReminderAt: 'nope', // wrong type -> null
      touches: { a: -1, b: 2, c: 'x' }, // only valid non-negative ints kept
    }),
  });
  setStorage(partial);

  const state = loadState();
  assert.equal(state.goal, 'Trip to France');
  assert.equal(state.targetDate, null);
  assert.equal(state.weeklyTarget, 7);
  assert.equal(state.push, 'unset');
  assert.equal(state.lastReminderAt, null);
  assert.deepEqual(state.touches, { b: 2 });
});

// ---------------------------------------------------------------------------
// Storage unavailable (Requirement 7.3, design Error Handling)
// ---------------------------------------------------------------------------

test('loadState returns defaults when storage is unavailable (null)', () => {
  setStorage(null);
  assert.deepEqual(loadState(), firstRunDefaults());
});

test('mutations do not throw when storage is unavailable (null)', () => {
  setStorage(null);
  assert.doesNotThrow(() => {
    saveGoal('Trip to France', '2026-11-01');
    clearGoal();
    setWeeklyTarget(5);
    setPushPref('granted');
    recordTouch('item-1');
  });
  // With no persistence, state stays at defaults.
  assert.deepEqual(loadState(), firstRunDefaults());
});

// ---------------------------------------------------------------------------
// Forbidden-field assertion (Requirement 6.2, Property 1)
// ---------------------------------------------------------------------------

test('persisted blob never contains forbidden attendance fields and stays within allowed fields', () => {
  // Exercise every writer so the persisted blob reflects real usage.
  saveGoal('Trip to France', '2026-11-01');
  setWeeklyTarget(5);
  setPushPref('granted');
  recordTouch('cafe-line');
  recordTouch('cafe-line');

  const raw = store._raw(STORAGE_KEY);
  assert.ok(raw != null, 'expected a persisted blob');

  const parsed = JSON.parse(raw);
  const keys = Object.keys(parsed);

  // None of the forbidden attendance fields may appear.
  for (const forbidden of FORBIDDEN_FIELDS) {
    assert.ok(
      !(forbidden in parsed),
      `persisted blob must not contain forbidden field "${forbidden}"`,
    );
  }

  // The persisted key set must be a subset of the allowed fields.
  for (const key of keys) {
    assert.ok(
      ALLOWED_FIELDS.includes(key),
      `persisted blob contains unexpected field "${key}"`,
    );
  }
});

test('forbidden fields present in a stored blob are stripped on load', () => {
  // Even if some other/older code wrote attendance fields, loadState must not
  // carry them through (normalizeState copies only known fields).
  const polluted = makeMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      goal: 'Trip',
      weeklyTarget: 3,
      streak: 10,
      lastOpened: 999,
      daysInARow: 5,
      daysActive: 20,
      sessionsThisWeek: 4,
      missedCount: 2,
    }),
  });
  setStorage(polluted);

  const state = loadState();
  for (const forbidden of FORBIDDEN_FIELDS) {
    assert.ok(
      !(forbidden in state),
      `loaded state must not contain forbidden field "${forbidden}"`,
    );
  }
  // And re-persisting keeps it clean.
  setWeeklyTarget(4);
  const parsed = JSON.parse(polluted._raw(STORAGE_KEY));
  for (const forbidden of FORBIDDEN_FIELDS) {
    assert.ok(!(forbidden in parsed), `re-persisted blob leaked "${forbidden}"`);
  }
});

// ---------------------------------------------------------------------------
// recordTouch cap (Requirement 5.5, Property 7)
// ---------------------------------------------------------------------------

test('recordTouch increments and caps at 2 per item', () => {
  recordTouch('item-a');
  assert.equal(loadState().touches['item-a'], 1);

  recordTouch('item-a');
  assert.equal(loadState().touches['item-a'], 2);

  // Third and further touches must not exceed the cap.
  recordTouch('item-a');
  recordTouch('item-a');
  assert.equal(loadState().touches['item-a'], 2);
});

test('recordTouch tracks items independently and ignores invalid ids', () => {
  recordTouch('item-a');
  recordTouch('item-b');
  recordTouch('item-b');
  const touches = loadState().touches;
  assert.equal(touches['item-a'], 1);
  assert.equal(touches['item-b'], 2);

  // Invalid ids are ignored (no throw, no entry).
  assert.doesNotThrow(() => {
    recordTouch('');
    recordTouch(null);
    recordTouch(42);
  });
  assert.deepEqual(loadState().touches, { 'item-a': 1, 'item-b': 2 });
});

// ---------------------------------------------------------------------------
// saveGoal / clearGoal round-trip (Requirement 1.3, 1.5, 7.1)
// ---------------------------------------------------------------------------

test('saveGoal persists goal and optional date, then loads back', () => {
  saveGoal('Trip to France', '2026-11-01');
  const state = loadState();
  assert.equal(state.goal, 'Trip to France');
  assert.equal(state.targetDate, '2026-11-01');
});

test('saveGoal treats a missing/empty date as null', () => {
  saveGoal('Just for fun');
  assert.equal(loadState().targetDate, null);

  saveGoal('Still no date', '');
  assert.equal(loadState().targetDate, null);
});

test('saveGoal coerces a non-string goal to empty string', () => {
  saveGoal(undefined, '2026-11-01');
  assert.equal(loadState().goal, '');
});

test('clearGoal clears goal and date but leaves cadence/push untouched', () => {
  saveGoal('Trip to France', '2026-11-01');
  setWeeklyTarget(6);
  setPushPref('granted');

  clearGoal();

  const state = loadState();
  assert.equal(state.goal, '');
  assert.equal(state.targetDate, null);
  // Cadence and push preference are preserved.
  assert.equal(state.weeklyTarget, 6);
  assert.equal(state.push, 'granted');
});

test('setPushPref persists only valid enum values', () => {
  setPushPref('granted');
  assert.equal(loadState().push, 'granted');

  // Invalid value is ignored, leaving the previous value intact.
  setPushPref('bogus');
  assert.equal(loadState().push, 'granted');
});
