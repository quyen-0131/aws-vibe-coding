// reminder-engine.js — pure logic for goal-linked reminders.
//
// Pure, side-effect-free functions (same inputs -> same output, no I/O):
//   nextThing(progress)               -> { itemId, name, minutes } | null
//   timeToGoal(targetDate, now)       -> "in about 4 weeks" | "soon" | null
//   composeCopy({ nextThing, goal, targetDate }) -> { title, body }   (task 5)
//   schedule({ weeklyTarget, lastReminderAt, now }) -> nextReminderAt (epoch ms)
//
// This is where the correctness properties live (design "Correctness Properties").
// Everything here is deterministic and has no side effects.

// --- Authored mission content -----------------------------------------------
//
// The single-conversation prototype points reminders at the available
// conversation/line. French tokens (e.g. « bonjour ») are AUTHORED here, never
// generated (Requirement 3.6). This small internal representation stands in for
// the mission order until additional missions exist (out of scope, §17.4).
const MISSION_ITEMS = [
  { itemId: "cafe-bonjour", name: "your « bonjour »", minutes: 6 },
];

// --- nextThing --------------------------------------------------------------
//
// Returns the specific item the reminder should point at, or null when nothing
// is due (Requirement 4.4). Reads the existing mission order and returns the
// first item the learner has not yet completed.
//
// `progress` shape (all optional / tolerant of undefined):
//   { completed?: string[] }   // itemIds already finished
//
// Returns a fresh copy so callers cannot mutate MISSION_ITEMS.
export function nextThing(progress) {
  const completed =
    progress && Array.isArray(progress.completed) ? progress.completed : [];

  const item = MISSION_ITEMS.find((it) => !completed.includes(it.itemId));
  if (!item) return null; // nothing due

  return { itemId: item.itemId, name: item.name, minutes: item.minutes };
}

// --- timeToGoal -------------------------------------------------------------
//
// Approximate, never-precise time to a goal's target date (Requirement 3.2).
// Safe for past/near dates: returns "soon" or null, never a negative count
// (Requirement 7.4).
//
//   targetDate: ISO date string "yyyy-mm-dd" | null | undefined
//   now:        epoch ms (defaults to Date.now())
//
//   -> "in about N week(s)" | "in about N month(s)" | "soon" | null
//
// null when there is no target date (or it is unparseable). Anything inside a
// week (including the past) is "soon" — we never imply urgency with a countdown.
export function timeToGoal(targetDate, now = Date.now()) {
  if (targetDate == null || targetDate === "") return null;

  const target = Date.parse(targetDate);
  if (Number.isNaN(target)) return null;

  const DAY = 24 * 60 * 60 * 1000;
  const days = Math.floor((target - now) / DAY);

  // Past, today, or within a week: no precise countdown, no negatives.
  if (days < 7) return "soon";

  const weeks = Math.round(days / 7);
  if (weeks < 8) {
    return `in about ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }

  const months = Math.round(days / 30);
  return `in about ${months} ${months === 1 ? "month" : "months"}`;
}

// --- schedule ---------------------------------------------------------------
//
// Computes the next reminder time (epoch ms) by spreading `weeklyTarget`
// reminders across 7 days, AT MOST one per day (Requirement 2.4).
//
// A no-action needs no special handling: we simply compute the next slot from
// `lastReminderAt` (or `now` on first schedule). There is no miss to record —
// this IS the quiet reschedule (Requirement 6.1).
//
//   weeklyTarget:   number in [1,7] (clamped defensively here)
//   lastReminderAt: epoch ms of the last reminder offered, or null
//   now:            epoch ms (defaults to Date.now())
//
//   -> nextReminderAt (epoch ms)
export function schedule({ weeklyTarget, lastReminderAt = null, now = Date.now() } = {}) {
  const DAY = 24 * 60 * 60 * 1000;

  // Defensive clamp: the store clamps too, but schedule must never place more
  // than one reminder per day, so target 0/NaN => 1, and cap at 7.
  let target = Math.round(Number(weeklyTarget));
  if (!Number.isFinite(target) || target < 1) target = 1;
  if (target > 7) target = 7;

  // Even spacing across the week, floored at one full day so we never exceed
  // one reminder per day (Requirement 2.4 / Property 6).
  const gapDays = Math.max(1, Math.floor(7 / target));
  const gap = gapDays * DAY;

  const base = lastReminderAt == null ? now : lastReminderAt;
  let next = base + gap;

  // If the computed slot is already in the past (a long gap with no action),
  // move it forward to the next slot from now — still one-per-day, still no
  // miss recorded.
  if (next <= now) {
    next = now + gap;
  }

  return next;
}

// --- composeCopy ------------------------------------------------------------
//
// Goal-linked, honest reminder copy (Requirement 3.1–3.6). Pure and
// deterministic: same inputs -> same { title, body }.
//
//   composeCopy({ nextThing, goal, targetDate, now }) -> { title, body } | null
//
//     nextThing:  { itemId, name, minutes } | null
//     goal:       string ("" or null/undefined when no goal)
//     targetDate: ISO date "yyyy-mm-dd" | null (only meaningful with a goal)
//     now:        epoch ms (defaults to Date.now()) — passed to timeToGoal
//
// Returns null when there is nothing to say (nextThing == null), so the banner
// shows nothing (Requirement 4.4) rather than a filler prompt.
//
// Honesty guarantees enforced BY CONSTRUCTION (design "Reminder copy rules"):
//   • The body always names the specific item (nextThing.name) and prices it
//     with an approximate duration (Requirement 3.5) — never a generic
//     "time to practise!".
//   • Any French token in the body (e.g. « bonjour ») comes from the authored
//     item name; nothing here generates French (Requirement 3.6).
//   • Time-to-goal is always approximate via timeToGoal ("about 4 weeks",
//     "soon"), never a precise countdown (Requirement 3.2).
//   • No count of days/sessions/absence and no reference to other learners
//     appears anywhere in the copy (Requirement 3.4). The only numbers are the
//     approximate duration (minutes) and the approximate time-to-goal.
//
// Three branches (Requirement 3.1, 3.3):
//   • goal + date  -> title flavors the goal with an approximate "to go"
//   • goal, no date -> title is a goal-directed "Toward ..." line
//   • no goal      -> neutral title, specific-but-goal-less (Requirement 3.3)
export function composeCopy({ nextThing, goal, targetDate, now = Date.now() } = {}) {
  // Nothing due -> say nothing (Requirement 4.4).
  if (nextThing == null) return null;

  // Body is identical across branches: always the specific, priced item
  // (Requirement 3.5). The item name carries any authored French token.
  const body = `Practise ${nextThing.name}? About ${nextThing.minutes} minutes.`;

  const hasGoal = typeof goal === "string" && goal.trim() !== "";
  if (!hasGoal) {
    // No-goal branch: neutral, specific-but-goal-less (Requirement 3.3).
    return { title: "Something's ready", body };
  }

  const goalText = goal.trim();

  // Approximate time-to-goal only (Requirement 3.2). timeToGoal never returns a
  // precise countdown or a negative number.
  const approx = timeToGoal(targetDate, now);

  if (approx != null) {
    // Goal + date branch. `approx` is like "in about 4 weeks" or "soon"; we
    // render it as a gentle "to go" hook without implying urgency.
    // e.g. "Trip to France — in about 4 weeks to go"  /  "... — soon"
    const suffix = approx === "soon" ? "soon" : `${approx} to go`;
    return { title: `${goalText} — ${suffix}`, body };
  }

  // Goal, no date branch (Requirement 3.1 with no target date).
  return { title: `Toward your ${lowerFirst(goalText)}`, body };
}

// Lowercases only the first character so "Trip to France" reads naturally after
// "Toward your ..." without altering authored casing elsewhere. Pure helper.
function lowerFirst(s) {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
