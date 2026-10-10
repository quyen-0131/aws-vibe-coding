# Requirements Document

## Introduction

This spec defines a **goal-linked reminder system** for the French practice app (defined in `PRD.md` and `CONTEXT.md`). It is the product's deliberate answer to the streak — the mechanic §4.4 and §17.1 ban outright.

A streak makes the learner accountable to a counter: opening the app and tapping through anything satisfies it, so nothing is actually remembered. This feature replaces that with a **pull toward a reason the learner gave us**: a personal goal ("a trip to France in a month"). A reminder never counts attendance and never induces guilt. It names a specific, ready thing and ties it to the learner's own goal — *"Trip to France in about 4 weeks — practise your « bonjour »? About 6 minutes."*

This directly extends PRD §8.2 (three sessions a week without a streak) and §8.3 (notifications that announce a ready thing and never comment on behavior), adding the new idea the PRD does not yet have: **the reminder is flavored by a goal the learner chose.**

### Design decisions captured from the product owner

- **Goal capture**: one optional goal (free text + optional target date), asked once after the first session, at the §6.2 4:40 "ask" moment. Skippable, editable later.
- **Delivery**: an in-app reminder banner that is always available, plus optional web push (permission asked after session one, never on page load).
- **Cadence**: default 3–4 reminders per week, adjustable 1–7. The system schedules toward the target but **never** shows a streak, an attendance count, or a "you missed X" message. Missing a day silently reschedules; nothing is lost.

### Boundary with the PRD's banned list

This feature must not reintroduce anything from §4.4 / §17.1: no streaks, chains, decay meters, "you missed N sessions" screens, guilt notifications, or any number whose only input is attendance. Every requirement below is written to stay inside that boundary.

## Glossary

- **Goal**: an optional, learner-authored statement of why they are learning French, optionally with a target date (e.g. "Trip to France" / 2026-11-01). Internal-facing structure; the learner just types a sentence and maybe picks a date.
- **Reminder**: a single prompt — in-app banner and/or web push — that names one specific ready thing and, where a goal exists, flavors it with the goal. Never comments on behavior.
- **Next thing**: the specific, named, priced practice item the reminder points at (PRD §8.2b "open loop"), e.g. "practise your « bonjour »? About 6 minutes."
- **Weekly target**: the learner's chosen number of reminders per week (default 3–4, range 1–7). A target we schedule toward, never a goal shown to the learner as a score.
- **Cadence**: the schedule by which reminders are offered across a week, derived from the weekly target.
- **Quiet reschedule**: when a reminder is not acted on, the system moves the next reminder forward without recording or displaying a miss.

## Requirements

### Requirement 1: Capture an optional personal goal

**User Story:** As a busy learner, I want to tell the app why I'm learning French, so that my reminders connect to something I actually care about.

#### Acceptance Criteria

1. WHEN the learner finishes their first session THEN the system SHALL offer a single optional prompt to enter a goal as free text, with an optional target date.
2. WHEN the goal prompt is shown THEN the system SHALL allow the learner to skip it without entering anything, and SHALL NOT block any further use of the app.
3. WHEN a learner enters a goal THEN the system SHALL persist it in local storage (no account, per PRD §13.5).
4. WHERE a learner has not set a goal THE system SHALL still deliver reminders, using neutral copy that names the next thing without a goal hook.
5. WHEN the learner opens settings THEN the system SHALL allow them to add, edit, or clear the goal and its target date at any time.
6. WHEN a target date is entered THEN the system SHALL accept a date only (no time-of-day), and SHALL treat it as optional.

### Requirement 2: Set and adjust reminder cadence

**User Story:** As a learner with an unpredictable schedule, I want to choose how often I'm reminded, so that the app fits my life rather than nagging me.

#### Acceptance Criteria

1. WHEN reminders are first enabled THEN the system SHALL default the weekly target to 3–4 reminders per week.
2. WHEN the learner opens settings THEN the system SHALL allow the weekly target to be changed within a range of 1 to 7 per week.
3. WHEN the learner changes the weekly target THEN the system SHALL apply the new cadence to future reminders without penalty or backfill.
4. WHERE the learner sets a higher target THE system SHALL schedule more frequently, up to at most one reminder per day.
5. WHEN cadence is displayed in settings THEN the system SHALL describe it in plain language (e.g. "about 3 times a week"), never as a streak, quota, or score.

### Requirement 3: Compose goal-linked, honest reminder copy

**User Story:** As a learner, I want a reminder that points at one specific thing and connects to my goal, so that it feels worth opening rather than like guilt.

#### Acceptance Criteria

1. WHEN a reminder is composed AND a goal exists THEN the reminder SHALL name the next thing and reference the goal (e.g. "Trip to France in about 4 weeks — practise your « bonjour »? About 6 minutes.").
2. WHEN a reminder is composed AND a target date exists THEN the system SHALL express the remaining time approximately ("in about 4 weeks"), never as a precise countdown that implies urgency.
3. WHEN a reminder is composed AND no goal exists THEN the reminder SHALL name only the next thing and its approximate length, with no goal hook.
4. WHEN any reminder is composed THEN it SHALL NOT contain a count of days, sessions, or absence, and SHALL NOT reference other learners (PRD §8.3, §17.1).
5. WHERE the next thing is known THE reminder SHALL always name it specifically and price it (approximate minutes), never a generic "time to practise!" (PRD §8.3).
6. WHEN any French appears in reminder copy THEN it SHALL be drawn from existing authored content, not generated (PRD §16.4).

### Requirement 4: In-app reminder surface

**User Story:** As a learner who declined notifications, I want to still see what's waiting when I open the app, so that I get the same product either way.

#### Acceptance Criteria

1. WHEN the learner opens the app AND a next thing is due THEN the system SHALL show an in-app reminder banner naming that thing and its goal hook (if any).
2. WHEN the in-app reminder is shown THEN it SHALL offer a clear action to start the next thing and a way to dismiss it.
3. WHEN the learner dismisses an in-app reminder THEN the system SHALL hide it for that session without recording a miss or showing any penalty.
4. WHERE no next thing is due THE system SHALL show nothing rather than a filler or generic prompt.
5. WHEN the in-app reminder renders THEN it SHALL NOT display any streak, count, or attendance indicator.

### Requirement 5: Optional web push permission and delivery

**User Story:** As a learner who wants a nudge, I want to opt into notifications at the right moment, so that a specific ready thing reaches me without me having to open the app.

#### Acceptance Criteria

1. WHEN the learner finishes their first session THEN the system SHALL offer to enable push reminders, tied to the promise (e.g. "Want a nudge when the café one is ready?").
2. WHEN the app first loads THEN the system SHALL NOT request notification permission (PRD §8.3 — never on page load).
3. IF the learner grants permission THEN the system SHALL schedule goal-linked push reminders at the chosen cadence.
4. IF the learner denies or ignores permission THEN the system SHALL continue to function fully with the in-app reminder only.
5. WHEN a push reminder is sent for a given next thing THEN the system SHALL send at most one, and at most one follow-up if unacted, then permanent silence for that item (PRD §8.3 — two touches maximum).
6. WHERE web push is unavailable in the learner's browser THE system SHALL say so plainly and fall back to the in-app reminder without degrading silently (PRD §9 tone).

### Requirement 6: Never count attendance (the anti-streak guarantee)

**User Story:** As the product owner, I want reminders to be impossible to satisfy by merely showing up, so that this feature never becomes the streak we deliberately rejected.

#### Acceptance Criteria

1. WHEN a scheduled reminder is not acted on THEN the system SHALL quietly reschedule the next reminder and SHALL NOT record, count, or display the miss (PRD §4.4, §8.2).
2. WHEN the app computes what to show THEN it SHALL NOT derive any headline number whose only input is attendance (PRD §4.4).
3. WHERE progress is surfaced anywhere near reminders THE system SHALL express it only as what the learner can do (can-do statements), never as frequency, streak, or a days-in-a-row figure (PRD §8.2c).
4. WHEN a learner returns after a long gap THEN the system SHALL present one thing to do and SHALL NOT acknowledge the gap or show accumulated/overdue items (PRD §10).

### Requirement 7: Local-only persistence and privacy

**User Story:** As a learner using an app with no account, I want my goal and reminder settings kept on my device, so that nothing personal leaves it.

#### Acceptance Criteria

1. WHEN a goal, target date, weekly target, or push preference is set THEN the system SHALL persist it in local storage only (PRD §11, §13.5).
2. WHEN reminder copy is composed THEN it SHALL be composed on the client from local data and authored content, and SHALL NOT send the learner's goal text to any third party (PRD §13.3 privacy rationale).
3. WHEN local storage is cleared THEN the system SHALL behave as a first-run learner (no goal, default cadence, no push), consistent with the local-only trade-off.
4. WHERE a target date has passed THE system SHALL continue to function, treating the goal as still valid unless the learner edits or clears it.
