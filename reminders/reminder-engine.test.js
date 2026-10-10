// reminder-engine.test.js — unit + property tests for the reminder engine.
//
// Uses Node's built-in test runner (node:test) and assertions (node:assert),
// no new npm dependency. Matches the `reminders/**/*.test.js` glob used by
// `npm test`.
//
// Property tests are implemented WITHOUT any PBT library: a small seeded
// pseudo-random generator drives a broad, systematically-generated range of
// inputs (many goals, target dates spanning past/near/weeks/months/far-future,
// weeklyTarget across and beyond [1,7], and various lastReminderAt). Each
// property runs over several hundred generated cases so it functions as a
// property test.
//
// Coverage:
//  UNIT
//   - nextThing: item when nothing completed; null when completed; tolerant of
//     undefined/empty progress.
//   - timeToGoal: null when no/unparseable date; "soon" for past/today/within a
//     week (never negative, Req 7.4); approximate weeks then months; deterministic.
//   - schedule: future epoch ms; gap >= 1 day for targets 1..7 and out-of-range
//     (0, 8, 99, NaN); quiet reschedule from a long-past lastReminderAt (Req 6.1).
//  PROPERTY
//   - Property 3 (Req 3.5): body names the item AND an approximate duration,
//     never the generic "time to practise".
//   - Property 4 (Req 3.4, 6.3): no attendance-style counts / learner comparisons;
//     the only digits are the approximate minutes and the approximate time-to-goal.
//   - Property 6 (Req 2.4): consecutive schedules are always >= 1 day apart, for a
//     wide weeklyTarget range; clampWeeklyTarget keeps the target in [1,7].

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  nextThing,
  timeToGoal,
  schedule,
  composeCopy,
} from './reminder-engine.js';

import { clampWeeklyTarget } from './reminder-store.js';

const DAY = 24 * 60 * 60 * 1000;

// Fixed reference "now" so date-based tests are deterministic.
// 2025-01-01T00:00:00Z.
const NOW = Date.parse('2025-01-01T00:00:00Z');

// ---------------------------------------------------------------------------
// Seeded pseudo-random generator (mulberry32) — deterministic, no dependency.
// ---------------------------------------------------------------------------
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A spread of plausible goal strings (some empty / whitespace to hit branches),
// none of which contain digits (so any digit in the copy comes from the engine).
const GOAL_SAMPLES = [
  '',
  '   ',
  'Trip to France',
  'Ordering coffee in Paris',
  'Talking to my French in-laws',
  'A weekend in Montréal',
  'Reading Le Petit Prince',
  'Impressing the waiter',
];

// Build a target date (ISO yyyy-mm-dd) offsetDays away from NOW, or null.
function dateFromOffset(offsetDays) {
  if (offsetDays == null) return null;
  return new Date(NOW + offsetDays * DAY).toISOString().slice(0, 10);
}

// ===========================================================================
// UNIT: nextThing
// ===========================================================================

test('nextThing returns the specific item when nothing is completed', () => {
  const item = nextThing({ completed: [] });
  assert.ok(item, 'expected an item');
  assert.equal(typeof item.itemId, 'string');
  assert.equal(typeof item.name, 'string');
  assert.equal(typeof item.minutes, 'number');
  assert.ok(item.minutes > 0);
});

test('nextThing returns null when the item is already completed', () => {
  const first = nextThing({ completed: [] });
  const after = nextThing({ completed: [first.itemId] });
  assert.equal(after, null);
});

test('nextThing tolerates undefined / empty / malformed progress', () => {
  assert.ok(nextThing(undefined), 'undefined progress -> first item');
  assert.ok(nextThing({}), 'empty progress -> first item');
  assert.ok(nextThing({ completed: null }), 'null completed -> first item');
  assert.ok(nextThing({ completed: 'nope' }), 'non-array completed -> first item');
});

test('nextThing returns a fresh copy (callers cannot mutate internal content)', () => {
  const a = nextThing({});
  a.name = 'mutated';
  const b = nextThing({});
  assert.notEqual(b.name, 'mutated');
});

// ===========================================================================
// UNIT: timeToGoal
// ===========================================================================

test('timeToGoal returns null for no date or unparseable date', () => {
  assert.equal(timeToGoal(null, NOW), null);
  assert.equal(timeToGoal(undefined, NOW), null);
  assert.equal(timeToGoal('', NOW), null);
  assert.equal(timeToGoal('not-a-date', NOW), null);
});

test('timeToGoal returns "soon" for past, today, and within-a-week dates (never negative)', () => {
  assert.equal(timeToGoal(dateFromOffset(-100), NOW), 'soon'); // long past
  assert.equal(timeToGoal(dateFromOffset(-1), NOW), 'soon'); // yesterday
  assert.equal(timeToGoal(dateFromOffset(0), NOW), 'soon'); // today
  assert.equal(timeToGoal(dateFromOffset(6), NOW), 'soon'); // within a week
});

test('timeToGoal expresses further-out dates approximately in weeks then months', () => {
  assert.equal(timeToGoal(dateFromOffset(7), NOW), 'in about 1 week');
  assert.equal(timeToGoal(dateFromOffset(28), NOW), 'in about 4 weeks');
  // ~ two months out -> months phrasing (weeks >= 8 switches to months).
  const twoMonths = timeToGoal(dateFromOffset(60), NOW);
  assert.match(twoMonths, /^in about \d+ months?$/);
});

test('timeToGoal is deterministic for a fixed now', () => {
  const date = dateFromOffset(30);
  assert.equal(timeToGoal(date, NOW), timeToGoal(date, NOW));
});

// ===========================================================================
// UNIT: schedule
// ===========================================================================

test('schedule returns a future epoch ms on first schedule', () => {
  const next = schedule({ weeklyTarget: 3, lastReminderAt: null, now: NOW });
  assert.ok(next > NOW, 'next reminder must be in the future');
});

test('schedule keeps a gap of at least one full day for every in-range target', () => {
  for (let target = 1; target <= 7; target++) {
    const next = schedule({ weeklyTarget: target, lastReminderAt: NOW, now: NOW });
    assert.ok(
      next - NOW >= DAY,
      `target ${target}: gap ${next - NOW} must be >= one day`,
    );
  }
});

test('schedule keeps a gap of at least one full day for out-of-range / bad targets', () => {
  for (const target of [0, 8, 99, NaN, -3, Infinity]) {
    const next = schedule({ weeklyTarget: target, lastReminderAt: NOW, now: NOW });
    assert.ok(
      next - NOW >= DAY,
      `target ${String(target)}: gap ${next - NOW} must be >= one day`,
    );
  }
});

test('schedule quietly reschedules a long-past lastReminderAt into the future (no miss)', () => {
  const longPast = NOW - 90 * DAY;
  const next = schedule({ weeklyTarget: 7, lastReminderAt: longPast, now: NOW });
  assert.ok(next > NOW, 'a long-past reminder must reschedule strictly into the future');
  assert.ok(next - NOW >= DAY, 'the rescheduled gap is still at least one day');
});

test('schedule tolerates being called with no arguments', () => {
  assert.doesNotThrow(() => schedule());
});

// ===========================================================================
// PROPERTY 3 (Req 3.5): every reminder names a specific, priced thing.
// ===========================================================================

test('Property 3: composeCopy body always names the item and an approximate duration, never generic', () => {
  // **Validates: Requirements 3.5**
  const rng = makeRng(0xa11ce);
  const item = nextThing({});
  const offsets = [null, -365, -30, -1, 0, 3, 7, 21, 45, 90, 200, 800];
  let cases = 0;

  for (let i = 0; i < 400; i++) {
    const goal = GOAL_SAMPLES[Math.floor(rng() * GOAL_SAMPLES.length)];
    const offset = offsets[Math.floor(rng() * offsets.length)];
    const targetDate = dateFromOffset(offset);

    const copy = composeCopy({ nextThing: item, goal, targetDate, now: NOW });
    assert.ok(copy, 'copy must exist when nextThing != null');

    // Names the specific item.
    assert.ok(
      copy.body.includes(item.name),
      `body must name the item "${item.name}": ${copy.body}`,
    );
    // Prices it with an approximate duration.
    assert.match(
      copy.body,
      /About \d+ minutes/,
      `body must price the item with approximate minutes: ${copy.body}`,
    );
    // Never the generic fallback string.
    assert.ok(
      !/time to practise/i.test(copy.body),
      `body must never be a generic "time to practise": ${copy.body}`,
    );
    cases++;
  }
  assert.ok(cases >= 400, 'expected the property to run over many cases');
});

test('Property 3: composeCopy returns null when nothing is due', () => {
  // **Validates: Requirements 3.5** (contrapositive — nothing due -> no filler)
  const copy = composeCopy({ nextThing: null, goal: 'Trip to France', now: NOW });
  assert.equal(copy, null);
});

// ===========================================================================
// PROPERTY 4 (Req 3.4, 6.3): copy never counts attendance or compares learners.
// ===========================================================================

// Forbidden substrings that would imply attendance counting or comparison to
// other learners (Req 3.4 / 6.3). Matched case-insensitively.
const FORBIDDEN_TERMS = [
  'streak',
  'day streak',
  'days in a row',
  'in a row',
  'sessions',
  'session',
  'missed',
  'miss',
  'absence',
  'absent',
  'other learners',
  'others',
  'everyone',
  'everybody',
  'behind',
  'catch up',
  'overdue',
  'daily',
  'days active',
];

test('Property 4: composeCopy contains no attendance counts and no learner comparisons', () => {
  // **Validates: Requirements 3.4, 6.3**
  const rng = makeRng(0xb0b);
  const item = nextThing({});
  const offsets = [null, -400, -30, -7, -1, 0, 5, 7, 14, 35, 70, 150, 365, 900];
  let cases = 0;

  for (let i = 0; i < 400; i++) {
    const goal = GOAL_SAMPLES[Math.floor(rng() * GOAL_SAMPLES.length)];
    const offset = offsets[Math.floor(rng() * offsets.length)];
    const targetDate = dateFromOffset(offset);

    const copy = composeCopy({ nextThing: item, goal, targetDate, now: NOW });
    assert.ok(copy, 'copy must exist when nextThing != null');

    const combined = `${copy.title} ${copy.body}`;
    const lower = combined.toLowerCase();

    // No forbidden attendance/comparison terms.
    for (const term of FORBIDDEN_TERMS) {
      assert.ok(
        !lower.includes(term),
        `copy must not contain forbidden term "${term}": ${combined}`,
      );
    }

    // The only numbers allowed are the approximate duration ("About N minutes")
    // and the approximate time-to-goal ("in about N weeks/months"). Strip those
    // known-allowed patterns, then assert no other digit remains.
    let stripped = combined
      .replace(/About \d+ minutes/g, '')
      .replace(/in about \d+ (?:weeks?|months?)/g, '');

    assert.ok(
      !/\d/.test(stripped),
      `copy must contain no digits beyond the approx duration/time-to-goal: ${combined}`,
    );
    cases++;
  }
  assert.ok(cases >= 400, 'expected the property to run over many cases');
});

// ===========================================================================
// PROPERTY 6 (Req 2.4): cadence stays within bounds (>= 1 reminder/day),
// and the store clamp keeps the target in [1,7].
// ===========================================================================

test('Property 6: consecutive schedules are always at least one day apart', () => {
  // **Validates: Requirements 2.4**
  const rng = makeRng(0xcafe);
  // A wide range of weeklyTargets including out-of-range and invalid values.
  const targets = [-5, 0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 99, NaN, Infinity];
  let cases = 0;

  for (let i = 0; i < 400; i++) {
    const weeklyTarget = targets[Math.floor(rng() * targets.length)];
    // Vary the starting point: some in the past, some now, some future.
    const startOffset = Math.floor((rng() - 0.5) * 200) * DAY; // +/- ~100 days
    let base = NOW + startOffset;
    let now = NOW;

    // Walk several consecutive schedules and assert each step >= one day.
    for (let step = 0; step < 6; step++) {
      const next = schedule({ weeklyTarget, lastReminderAt: base, now });
      // The next reminder must be strictly in the future relative to `now`...
      assert.ok(next > now, `step ${step}: next (${next}) must be after now (${now})`);
      // ...and consecutive reminders must be at least a full day apart.
      const prev = Math.max(base, now); // effective previous slot the engine advances from
      assert.ok(
        next - prev >= DAY,
        `weeklyTarget ${String(weeklyTarget)} step ${step}: gap ${next - prev} must be >= one day`,
      );
      // Advance: this reminder becomes the last, and time moves to it.
      base = next;
      now = next;
      cases++;
    }
  }
  assert.ok(cases >= 400, 'expected the property to run over many cases');
});

test('Property 6: clampWeeklyTarget always yields a value in [1,7]', () => {
  // **Validates: Requirements 2.2**
  const rng = makeRng(0xd00d);
  for (let i = 0; i < 400; i++) {
    // Mix of integers, fractionals, out-of-range, and non-finite inputs.
    let input;
    const kind = Math.floor(rng() * 4);
    if (kind === 0) input = Math.floor((rng() - 0.5) * 40); // -20..20 ints
    else if (kind === 1) input = (rng() - 0.5) * 40; // fractional
    else if (kind === 2) input = [NaN, Infinity, -Infinity][Math.floor(rng() * 3)];
    else input = rng() * 1000; // large positive

    const clamped = clampWeeklyTarget(input);
    assert.ok(
      Number.isInteger(clamped) && clamped >= 1 && clamped <= 7,
      `clampWeeklyTarget(${String(input)}) => ${clamped} must be an integer in [1,7]`,
    );
  }
});
