# Implementation Plan — Goal-Linked Reminders

## Overview

Build a goal-linked reminder system: capture one optional goal, schedule reminders at a learner-chosen weekly cadence (default 3–4/week, range 1–7), and deliver each as an in-app banner plus optional locally-scheduled web notifications — always naming a specific, priced "next thing" and never counting attendance. Work proceeds bottom-up: persistence store and pure engine first (with unit tests), then in-app UI, then the optional notification path, then integration and verification.

## Tasks

- [x] 1. Set up a minimal test harness
  - Add a `test` script to `package.json` using Node's built-in `node:test` (no new dependency)
  - Create a `reminders/` module folder for the store and engine
  - _Requirements: 6.1, 6.2_

- [x] 2. Implement the persistence store (`reminder-store`)
  - Read/write a single versioned `localStorage` blob (goal, targetDate, weeklyTarget, push, lastReminderAt, touches)
  - Implement `loadState`, `saveGoal`, `clearGoal`, `setWeeklyTarget` (clamp 1–7), `setPushPref`, `recordTouch`, `firstRunDefaults`
  - Deliberately include NO attendance fields (no streak/lastOpened/sessionsThisWeek/missedCount)
  - _Requirements: 1.3, 1.5, 2.1, 2.2, 2.3, 6.2, 7.1, 7.3_

- [x] 3. Write store unit tests
  - Test weekly-target clamping to [1,7], first-run defaults, and corrupt-blob reset to defaults
  - Assert the persisted shape contains none of the forbidden attendance fields
  - _Requirements: 2.2, 6.2, 7.3_

- [x] 4. Implement the reminder engine pure functions (`reminder-engine`)
  - `nextThing(progress)` returning the specific item {itemId, name, minutes} or null
  - `timeToGoal(targetDate, now)` returning approximate text ("in about 4 weeks" / "soon" / null), never a precise countdown, safe for past dates
  - `schedule({weeklyTarget, lastReminderAt, now})` spreading reminders across the week, at most one/day, with quiet reschedule on no-action
  - _Requirements: 2.4, 3.2, 4.4, 6.1, 7.4_

- [x] 5. Implement goal-linked copy composition (`composeCopy`)
  - Branches: goal+date, goal-only, no-goal — each naming the next thing and its approximate minutes
  - Pull any French token (e.g. « bonjour ») from authored content only; never generate French
  - Guarantee no days/sessions/absence counts and no reference to other learners
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Write engine unit + property tests
  - Cover nextThing, timeToGoal, schedule (bounds + quiet reschedule)
  - Property tests over a range of goals/dates: copy always names a priced thing (Property 3) and never contains attendance digits or learner comparisons (Property 4)
  - Assert schedule never exceeds one reminder/day and target stays in [1,7] (Property 6)
  - _Requirements: 2.4, 3.4, 3.5, 6.1, 6.3_

- [x] 7. Add the goal-capture prompt after the first session
  - One optional free-text goal + optional date + Skip, hooked into the end-of-session screen (no blocking flow)
  - Persist via the store on submit; skipping leaves no goal and does not block the app
  - _Requirements: 1.1, 1.2, 1.4, 1.6_

- [x] 8. Build the in-app reminder banner
  - Render at the top of the app shell when `nextThing() !== null` and not dismissed this session
  - Show composed copy, a Start action to the next thing, and a dismiss control that records no miss
  - Show nothing when no next thing is due; never render a streak/count/attendance indicator
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.3_

- [x] 9. Build the reminder settings panel
  - Add/edit/clear goal and target date
  - Weekly-target control (1–7) with plain-language label ("about 3 times a week"), never a quota/score
  - Push toggle reflecting current permission state
  - _Requirements: 1.5, 2.2, 2.5_

- [x] 10. Implement the optional notification path (service worker + permission)
  - Register `sw.js` only after opt-in; never request permission on page load
  - Offer the opt-in at end of first session, tied to the promise copy
  - Show locally-scheduled notifications via the service worker; open the app at the next thing on click
  - Enforce at most two touches per item (one + one follow-up), then permanent silence, using the store's `touches`
  - Plain fallback message where notifications are unsupported/denied; in-app banner remains
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.2_

- [x] 11. Wire the anti-streak and long-gap guarantees end to end
  - On a not-acted reminder, quietly reschedule with no recorded miss anywhere in state or UI
  - On return after a long gap, present one thing to do; do not acknowledge the gap or show overdue items
  - Verify no code path derives a headline number from attendance
  - _Requirements: 6.1, 6.2, 6.4, 4.4_

- [x] 12. Integration and honesty verification
  - Run `npm start`, finish a session, confirm goal prompt appears and is skippable
  - Set a goal + date; confirm banner and (if opted in) notification copy name a specific priced thing with an approximate goal hook
  - Toggle weekly target; confirm cadence description is plain language and no streak/count appears anywhere
  - Confirm goal text is never sent over the network; confirm graceful fallback where push is unsupported
  - Run `npm test` and confirm all engine/store/property tests pass
  - _Requirements: 3.4, 5.6, 6.1, 6.2, 6.3, 7.2_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"], "description": "Test harness and module scaffolding" },
    { "wave": 2, "tasks": ["2", "4"], "description": "Persistence store and pure engine (depend on 1)" },
    { "wave": 3, "tasks": ["3", "5"], "description": "Store tests; copy composition (depend on 2 and 4)" },
    { "wave": 4, "tasks": ["6"], "description": "Engine + property tests (depend on 4 and 5)" },
    { "wave": 5, "tasks": ["7", "8", "9"], "description": "In-app UI: goal prompt, banner, settings (depend on 2, 5)" },
    { "wave": 6, "tasks": ["10"], "description": "Optional notification path (depends on 2, 5, 9)" },
    { "wave": 7, "tasks": ["11"], "description": "Anti-streak + long-gap guarantees end to end (depends on 8, 10)" },
    { "wave": 8, "tasks": ["12"], "description": "Integration and honesty verification (depends on all)" }
  ]
}
```

- Task 1 (harness) blocks the testable modules.
- The store (2) and engine (4) are the foundation; copy (5) depends on the engine, tests (3, 6) depend on their targets.
- UI tasks (7–9) depend on the store and copy existing; the notification path (10) depends on settings (9) for the toggle.
- Task 11 ties the guarantees together across banner and notifications; task 12 is the final verification gate.

## Notes

- v1 uses locally-scheduled notifications via a service worker, not server-sent Web Push — keeps the feature client-side and consistent with PRD §11/§13.5 (local-only, no account). Server push (VAPID + subscription store) is deferred.
- No new npm dependencies: tests use Node's built-in `node:test`; notifications use the platform Notifications API + service worker.
- The persisted model intentionally omits all attendance fields; their absence is the anti-streak guarantee (design Property 1).
- Reminder French tokens are drawn from authored content only, never generated (PRD §16.4).
