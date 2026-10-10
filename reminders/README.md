# reminders/

Client-side module folder for the **goal-linked reminders** feature
(see `.kiro/specs/goal-linked-reminders/`).

## Modules (built bottom-up per the implementation plan)

- `reminder-store.js` — persistence: read/write a single versioned `localStorage`
  blob (goal, targetDate, weeklyTarget, push pref, lastReminderAt, per-item touches).
  Deliberately holds **no** attendance fields (no streak/lastOpened/sessionsThisWeek/
  missedCount) — that absence is the anti-streak guarantee.
- `reminder-engine.js` — pure functions: `nextThing`, `timeToGoal`, `composeCopy`,
  `schedule`. Same inputs → same output, no side effects, fully unit-testable.

## Tests

Tests use Node's built-in `node:test` runner — **no new npm dependency**.
Test files live alongside the modules using the `*.test.js` suffix and are run with:

```
npm test        # -> node --test reminders/
```

An empty (or placeholder-only) test set is acceptable at the harness stage.
