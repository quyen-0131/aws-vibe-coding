// anti-streak.test.js — module-level end-to-end tests for the anti-streak and
// long-gap guarantees wired in task 11.
//
// Uses Node's built-in test runner (node:test) and assertions (node:assert),
// no new npm dependency. Matches the `reminders/**/*.test.js` glob used by
// `npm test`.
//
// These exercise the store + engine together the same way the app wires them:
// on a not-acted reminder the app calls schedule() and records ONLY the new
// lastReminderAt (setLastReminderAt) — never a miss/streak/penalty. The tests
// prove that guarantee holds across a sequence of unacted reschedules and after
// a long gap, and that the persisted shape never grows an attendance field.
//
// Coverage:
//   Property 2 (Req 6.1, 4.3): a sequence of unacted schedules changes state
//     ONLY in lastReminderAt (and touches only when recordTouch is called);
//     weeklyTarget / goal / targetDate are untouched and no forbidden field
//     ever appears.
//   Long gap (Req 6.4, 4.4): schedule() from a 365-days-past lastReminderAt
//     returns exactly one timestamp strictly in the future (a single slot, not
//     a backlog), and timeToGoal for a past targetDate is "soon" (never negative).
//   Property 1 (Req 6.2): the persisted blob after exercising the full writer
//     set — including the new setLastReminderAt — contains none of the forbidden
//     attendance fields.
//   setLastReminderAt: persists a finite timestamp, clamps non-finite to null,
//     and introduces no attendance field.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  STORAGE_KEY,
  setStorage,
  loadState,
  saveGoal,
  setWeeklyTarget,
  setPushPref,
  recordTouch,
  setLastReminderAt,
} from './reminder-store.js';

import { schedule, timeToGoal } from './reminder-engine.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2025-01-01T00:00:00Z');

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
// guarantee — Requirement 6.2, design Property 1) plus common near-misses.
const FORBIDDEN_FIELDS = [
  'streak',
  'lastOpened',
  'daysInARow',
  'daysActive',
  'sessionsThisWeek',
  'missedCount',
  'missed',
  'miss',
  'misses',
  'skipped',
  'penalty',
];

/** Minimal in-memory Web Storage stand-in, fresh per test. */
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

function assertNoForbiddenFields(state, where) {
  for (const forbidden of FORBIDDEN_FIELDS) {
    assert.ok(
      !(forbidden in state),
      `${where}: state must not contain forbidden field "${forbidden}"`,
    );
  }
  for (const key of Object.keys(state)) {
    assert.ok(
      ALLOWED_FIELDS.includes(key),
      `${where}: state contains unexpected field "${key}"`,
    );
  }
}

// ===========================================================================
// Property 2 (Req 6.1, 4.3): a missed reminder loses nothing.
// ===========================================================================

test('Property 2: a sequence of unacted reschedules changes only lastReminderAt', () => {
  // **Validates: Requirements 6.1, 4.3**
  // Set a goal + cadence, then simulate the app's quiet-reschedule loop: on each
  // unacted reminder, compute the next slot with schedule() and record ONLY the
  // new lastReminderAt via setLastReminderAt. Assert nothing else moves.
  saveGoal('Trip to France', '2026-11-01');
  setWeeklyTarget(4);

  const baseline = loadState();
  assertNoForbiddenFields(baseline, 'baseline');

  let now = NOW;
  let prev = baseline.lastReminderAt; // null on first schedule

  for (let i = 0; i < 8; i++) {
    const before = loadState();

    // The engine computes the next slot; the app records only that timestamp.
    const next = schedule({
      weeklyTarget: before.weeklyTarget,
      lastReminderAt: before.lastReminderAt,
      now,
    });
    setLastReminderAt(next);

    const after = loadState();

    // Only lastReminderAt changed. Everything else is byte-for-byte identical.
    assert.equal(after.goal, before.goal, 'goal must not change on a miss');
    assert.equal(after.targetDate, before.targetDate, 'targetDate must not change');
    assert.equal(after.weeklyTarget, before.weeklyTarget, 'weeklyTarget must not change');
    assert.equal(after.push, before.push, 'push must not change');
    assert.deepEqual(after.touches, before.touches, 'touches must not change without recordTouch');

    // lastReminderAt advanced strictly forward and stays >= one day from the
    // previous slot the engine advanced from (no stacking, one-per-day).
    assert.equal(after.lastReminderAt, next);
    if (prev != null) {
      assert.ok(after.lastReminderAt - prev >= DAY, 'reschedule keeps a >= 1 day gap');
    }
    assert.ok(after.lastReminderAt > now, 'reschedule always lands in the future');

    // No forbidden attendance field ever appears.
    assertNoForbiddenFields(after, `after miss #${i}`);

    prev = after.lastReminderAt;
    now = after.lastReminderAt; // time advances to the reminder we just offered
  }

  // Goal / cadence are exactly what we set — a run of misses cost nothing.
  const end = loadState();
  assert.equal(end.goal, 'Trip to France');
  assert.equal(end.targetDate, '2026-11-01');
  assert.equal(end.weeklyTarget, 4);
});

test('Property 2: touches only change when recordTouch is called, never on a reschedule', () => {
  // **Validates: Requirements 6.1**
  setWeeklyTarget(3);

  // A reschedule leaves touches empty.
  const next = schedule({ weeklyTarget: 3, lastReminderAt: null, now: NOW });
  setLastReminderAt(next);
  assert.deepEqual(loadState().touches, {}, 'reschedule must not touch `touches`');

  // Only an explicit recordTouch (a real notification send) changes it.
  recordTouch('cafe-bonjour');
  assert.deepEqual(loadState().touches, { 'cafe-bonjour': 1 });

  // Another reschedule after a touch still leaves touches unchanged.
  const next2 = schedule({ weeklyTarget: 3, lastReminderAt: next, now: next });
  setLastReminderAt(next2);
  assert.deepEqual(loadState().touches, { 'cafe-bonjour': 1 });
});

// ===========================================================================
// Long gap (Req 6.4, 4.4): return after a long absence -> ONE thing, no backlog.
// ===========================================================================

test('long gap: schedule() from a 365-days-past reminder yields exactly one future slot', () => {
  // **Validates: Requirements 6.4, 4.4**
  const longPast = NOW - 365 * DAY;

  const next = schedule({ weeklyTarget: 4, lastReminderAt: longPast, now: NOW });

  // A single timestamp strictly in the future — not an array, not a backlog.
  assert.equal(typeof next, 'number');
  assert.ok(next > NOW, 'the single next slot must be strictly in the future');
  // And it is at most one week out (one slot at the chosen cadence), never a
  // pile of overdue reminders stacked from the past year.
  assert.ok(next - NOW <= 7 * DAY, 'the next slot is a single near-future reminder, not a backlog');
});

test('long gap: a past target date reads as "soon", never a negative countdown', () => {
  // **Validates: Requirements 6.4, 7.4**
  const pastDate = new Date(NOW - 365 * DAY).toISOString().slice(0, 10);
  assert.equal(timeToGoal(pastDate, NOW), 'soon');

  // Recording the return via the quiet reschedule adds no gap/overdue state.
  const next = schedule({ weeklyTarget: 3, lastReminderAt: NOW - 400 * DAY, now: NOW });
  setLastReminderAt(next);
  assertNoForbiddenFields(loadState(), 'after long-gap return');
});

// ===========================================================================
// Property 1 (Req 6.2): persisted shape never grows an attendance field, even
// after exercising the full writer set including setLastReminderAt.
// ===========================================================================

test('Property 1: full writer set (incl. setLastReminderAt) never persists an attendance field', () => {
  // **Validates: Requirements 6.2**
  saveGoal('Trip to France', '2026-11-01');
  setWeeklyTarget(6);
  setPushPref('granted');
  recordTouch('cafe-bonjour');
  const next = schedule({ weeklyTarget: 6, lastReminderAt: null, now: NOW });
  setLastReminderAt(next);

  const raw = store._raw(STORAGE_KEY);
  assert.ok(raw != null, 'expected a persisted blob');
  const parsed = JSON.parse(raw);

  for (const forbidden of FORBIDDEN_FIELDS) {
    assert.ok(!(forbidden in parsed), `persisted blob leaked forbidden field "${forbidden}"`);
  }
  for (const key of Object.keys(parsed)) {
    assert.ok(ALLOWED_FIELDS.includes(key), `persisted blob has unexpected field "${key}"`);
  }
});

// ===========================================================================
// setLastReminderAt: persists finite ts, clamps non-finite to null, adds nothing.
// ===========================================================================

test('setLastReminderAt persists a finite timestamp', () => {
  setLastReminderAt(NOW + 3 * DAY);
  assert.equal(loadState().lastReminderAt, NOW + 3 * DAY);
});

test('setLastReminderAt clamps non-finite / non-numeric input to null', () => {
  setLastReminderAt(NOW + DAY);
  assert.equal(loadState().lastReminderAt, NOW + DAY);

  for (const bad of [NaN, Infinity, -Infinity, 'soon', null, undefined, {}]) {
    setLastReminderAt(bad);
    assert.equal(loadState().lastReminderAt, null, `setLastReminderAt(${String(bad)}) must clear to null`);
  }
});

test('setLastReminderAt introduces no attendance field', () => {
  setLastReminderAt(NOW);
  assertNoForbiddenFields(loadState(), 'after setLastReminderAt');
  const parsed = JSON.parse(store._raw(STORAGE_KEY));
  assertNoForbiddenFields(parsed, 'persisted after setLastReminderAt');
});
