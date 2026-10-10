# Design — Goal-Linked Reminders

## Overview

A goal-linked reminder system that replaces the streak with a pull toward a reason the learner gave us. It captures one optional goal, schedules reminders at a learner-chosen weekly cadence (default 3–4/week), and delivers each reminder as an in-app banner and optionally as a web push notification — always naming one specific "next thing" and, where a goal exists, flavoring it with that goal.

The design honors the PRD's hard boundary (§4.4, §8.3, §17.1): no attendance counting, no streak, no guilt, no generated French, local-only storage.

This is the app's first stateful, persistent feature. Everything until now was in-memory (`FRESH()`/`S` in the prototype) and reset on reload. This spec introduces a small local-storage layer and, for push, a service worker — the first server/browser infrastructure beyond the static file server.

## Reference to existing code

The reference implementation is `weekend-mission-prototype.html` (per PRD §16). It currently has:

- In-memory state `S` via `FRESH()`, reset every load — no persistence anywhere.
- A single static server (`server.js`) that serves files and proxies the Gemini matcher.
- No `Notification`, no `serviceWorker`, no `localStorage` (verified by search).

So this feature is greenfield. It adds a persistence module, a reminder module, and (optionally) a service worker, without changing the mission flow.

## Architecture

```
Browser (client)
├── reminder-store.js        NEW — localStorage read/write, first-run defaults
│     goal, targetDate, weeklyTarget, push pref, per-item touch log
├── reminder-engine.js       NEW — pure functions:
│     • nextThing()          which item to point at (from mission order)
│     • composeCopy()        goal-linked, honest reminder text
│     • schedule()           next reminder time from weeklyTarget (quiet reschedule)
│     • timeToGoal()         approximate "in about N weeks"
├── reminder-ui              NEW — in-app banner + settings panel + goal prompt
│     (integrated into the app's existing render() loop)
└── sw.js (service worker)   NEW, optional — receives/show push, handles click

Server (server.js)
└── (unchanged for in-app path)
    push path is OUT OF SCOPE for wiring in v1 — see "Push scope" below
```

### Push scope decision (important)

True server-sent Web Push requires a push service, VAPID keys, and a subscription stored server-side — which conflicts with the PRD's "local-only, no account" stance (§11, §13.5) and adds backend state the product deliberately avoids.

For v1 this design uses **locally-scheduled notifications**, not server push:

- With permission granted, reminders are scheduled and shown by a **service worker** using the Notifications API and local timing, triggered when the app/service worker is active — no server, no subscription, no learner data leaving the device (satisfies Requirement 7.2).
- This is honest about its limitation (Requirement 5.6): it cannot wake a fully-closed browser the way server push can. The design surfaces that plainly rather than pretending otherwise, and the in-app banner (Requirement 4) is the always-present fallback.
- Server-sent push (with VAPID + a subscription store) is explicitly deferred; it would require revisiting §13.5.

This keeps the whole feature client-side and consistent with the product's privacy posture, at the cost of not reaching a hard-closed browser. That trade is called out in the requirements' honesty rules (5.6) and is the right v1 shape.

## Components and Interfaces

### reminder-store (persistence)

```
loadState()            -> { goal, targetDate, weeklyTarget, push, touches }
saveGoal(text, date)   -> void        // date optional; text may be ""
clearGoal()            -> void
setWeeklyTarget(n)     -> void        // clamps to [1,7]
setPushPref(bool)      -> void
recordTouch(itemId)    -> void        // for the "max 2 touches" rule
firstRunDefaults()     -> state       // no goal, weeklyTarget=3, push=off
```

- Backed by a single `localStorage` key (namespaced, e.g. `lsp.reminders.v1`) holding a JSON blob.
- No attendance fields. There is deliberately no `lastOpened`, `streak`, `daysActive`, or `missedCount` — storing them would tempt a later feature to display them (Requirement 6.2).
- `touches` records only per-item notification sends (to enforce §8.3's two-touch cap), not sessions or opens.

### reminder-engine (pure logic)

```
nextThing(progress)              -> { itemId, name, minutes } | null
timeToGoal(targetDate, now)      -> "in about 4 weeks" | "soon" | null
composeCopy({ nextThing, goal, targetDate }) -> { title, body }
schedule({ weeklyTarget, lastReminderAt, now }) -> nextReminderAt
```

- All pure and unit-testable: same inputs → same output, no side effects. This is where the correctness properties live.
- `nextThing` reads the existing mission order; in the current single-conversation prototype it points at the available conversation/line. It returns `null` when nothing is due (Requirement 4.4).
- `composeCopy` is the heart of the feature. Branches: goal + date, goal only, no goal (Requirement 3.1, 3.3). It pulls any French token (e.g. « bonjour ») from authored content, never generated (Requirement 3.6).
- `schedule` spreads `weeklyTarget` reminders across 7 days, at most one/day (Requirement 2.4), and on a no-action simply computes the next slot — there is no miss to record (Requirement 6.1, "quiet reschedule").

### reminder-ui

- **Goal prompt**: shown once after the first session (at the §6.2 4:40 moment). One text field + optional date + Skip. Wired into the existing end-of-session screen (`screenDone` area), not a separate blocking flow.
- **In-app banner**: rendered at the top of the app shell when `nextThing() !== null` and not dismissed this session. Contains the composed copy, a "Start" action, and a dismiss control (Requirement 4.1–4.3).
- **Settings panel**: goal (add/edit/clear), target date, weekly target slider/stepper (1–7, plain-language label), and the push toggle (Requirement 1.5, 2.2, 2.5).

### service worker (sw.js) — optional path

```
'push'/'notificationScheduled'  -> self.registration.showNotification(title, { body, ... })
'notificationclick'             -> focus/open the app at the next thing
```

- Registered only after the learner opts in (Requirement 5.1–5.2).
- Uses locally-scheduled timing (see Push scope). Enforces the two-touch cap via `touches` from the store (Requirement 5.5).

## Data Models

New persisted state (single localStorage blob, versioned):

```
ReminderState {
  goal:         string        // "" if none
  targetDate:   string|null   // ISO date (yyyy-mm-dd), no time; null if none
  weeklyTarget: number        // 1..7, default 3
  push:         "unset"|"granted"|"denied"|"unsupported"
  lastReminderAt: number|null // epoch ms of last reminder offered
  touches:      { [itemId: string]: number }  // sends per next-thing, cap 2
}
```

Deliberately **absent** fields (documented so they are never added): `streak`, `daysInARow`, `lastOpened`, `sessionsThisWeek`, `missedCount`. Their absence is a design guarantee for Requirement 6.

Reminder copy shape (transient, not persisted):

```
ReminderCopy { title: string, body: string }
```

Example outputs of `composeCopy`:

- Goal + date: `{ title: "Trip to France — about 4 weeks to go", body: "Practise your « bonjour »? About 6 minutes." }`
- Goal, no date: `{ title: "Toward your trip to France", body: "Practise your « bonjour »? About 6 minutes." }`
- No goal: `{ title: "Something's ready", body: "Practise your « bonjour »? About 6 minutes." }`

All French tokens in the body come from authored content (Requirement 3.6).

## Reminder copy rules (the honesty layer)

`composeCopy` must satisfy, by construction:

- Always names the next thing and its approximate minutes (Requirement 3.5).
- Time-to-goal is always approximate ("about 4 weeks", "soon"), never a precise countdown (Requirement 3.2).
- Never includes days/sessions/absence counts or references to other learners (Requirement 3.4).
- Falls back to a specific-but-goal-less line when no goal exists (Requirement 3.3), never a generic "time to practise!".

These are enforced as pure-function properties (below), so a future edit that violates them fails a test rather than shipping.

## Correctness Properties

### Property 1: No attendance number is ever produced

For all reminder state and all rendered reminder surfaces, no value is computed or displayed whose only input is attendance (opens, days-in-a-row, sessions/week, misses). The persisted model has no such field, and the engine exposes no such function.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 2: A missed reminder loses nothing

For any sequence of scheduled reminders where some are not acted on, `schedule()` produces the next reminder time and no miss is recorded or surfaced; state after a miss differs from state after an action only in `lastReminderAt`/`touches`, never in a penalty or count.

**Validates: Requirements 6.1, 4.3**

### Property 3: Every reminder names a specific, priced thing

For all outputs of `composeCopy` where `nextThing !== null`, the body contains the item name and an approximate duration, and never a generic "time to practise" string.

**Validates: Requirements 3.5, 4.4**

### Property 4: Copy never counts or compares

For all outputs of `composeCopy`, the text contains no digit sequence representing days/sessions/absence and no reference to other learners; any number present is an approximate duration or an approximate time-to-goal only.

**Validates: Requirements 3.4, 6.3**

### Property 5: Goal text never leaves the device

For all reminder composition, the goal string is read from local storage and used only client-side; no network request carries it. (The Gemini matcher is unaffected — it receives learner utterances during a session, never the goal.)

**Validates: Requirements 7.2**

### Property 6: Cadence stays within bounds

For all `weeklyTarget` inputs, `setWeeklyTarget` clamps to [1,7] and `schedule()` never places more than one reminder per day.

**Validates: Requirements 2.2, 2.4**

### Property 7: At most two touches per item

For any next-thing item, the number of push reminders sent (tracked in `touches`) never exceeds two (one plus one follow-up), after which the item is permanently silent.

**Validates: Requirements 5.5**

## Error Handling

- **localStorage unavailable / disabled**: fall back to in-memory defaults for the session; reminders work in-app but do not persist. Say nothing alarming; behave as first-run (Requirement 7.3).
- **Notifications unsupported / permission denied**: continue with in-app banner only; state `push: "unsupported"|"denied"` and show the plain fallback message (Requirement 5.4, 5.6).
- **Service worker registration fails**: degrade to in-app only; no error surfaced to the learner beyond the plain "notifications aren't available in this browser" note.
- **Corrupt/old stored blob**: on parse failure, reset to first-run defaults (Requirement 7.3) rather than crashing.
- **Target date in the past**: keep functioning; treat goal as valid until edited (Requirement 7.4); `timeToGoal` returns "soon"/null rather than a negative count.

## Testing Strategy

The engine is pure functions, so unlike the UI-polish spec this feature **can** be unit-tested. There is no test runner in the repo yet; this spec introduces a minimal one (Node's built-in `node:test`, no new dependency) for the engine only.

1. **Engine unit tests** (`node --test`): cover `nextThing`, `timeToGoal`, `composeCopy` (all three goal branches), `schedule` (bounds + quiet reschedule), and the two-touch cap. The correctness properties above map directly to test cases.
2. **Copy property tests**: assert Properties 3 and 4 over a range of goals/dates — no attendance digits, always names a priced thing.
3. **Store tests**: clamping (Property 6), first-run defaults, corrupt-blob reset.
4. **Manual integration walk**: run `npm start`, finish a session, confirm the goal prompt appears and is skippable, set a goal + date, confirm the in-app banner copy, toggle the weekly target, and confirm no streak/count appears anywhere.
5. **Notification manual check**: opt in, confirm permission is not requested on load, confirm at most two touches per item, confirm graceful fallback where unsupported.

## Integration with existing app

- The mission flow and its state machine are untouched. The reminder banner mounts in the app shell above `#app`; the goal prompt hooks into the end-of-session screen; settings is a new lightweight screen reachable from the shell.
- Persistence is additive: the existing in-memory `S` stays as-is for session flow; only reminder/goal data is persisted.
- No change to the Gemini matcher, speech, chunking, or content.

## Out of scope

- Server-sent Web Push (VAPID, subscription store) — deferred; would require revisiting §13.5.
- Email fallback (PRD §8.3 flags it as maybe-unnecessary) — not in v1.
- Adaptive cadence that intensifies toward the goal date — considered and deferred; v1 uses a flat learner-chosen weekly target.
- Multiple goals, structured goal types, or goal progress tracking.
- The second conversation / additional missions (separate product work, §17.4).
