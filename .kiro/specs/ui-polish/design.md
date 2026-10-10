# Design — UI/UX Polish

## Overview

This is a presentation-only redesign of the reference prototype (`weekend-mission-prototype.html`). The flow, state machine, matcher, speech, chunking, and content stay as they are (Requirement 8). What changes is the visual system, the layout craft, the interactive states, and the removal of developer-facing content.

The output is a new file, `app.html`, that keeps the same self-contained single-file structure (inline `<style>` + `<script>`), reuses the existing JavaScript logic, and replaces the styling and markup scaffolding. The original prototype is left untouched as a reference.

## Reference and interpretation

The design reference is [pixelrise.ai](https://pixelrise.ai/): a dark "command center" aesthetic — deep near-black backgrounds, a vivid accent, glassmorphism cards, monospace/terminal-style system labels, restrained glow, confident type, generous spacing, and subtle motion.

We adopt the reference's **craft**, not its **energy**. The PRD (§4, §17) forbids scores, streaks, celebration, hype, and reward mechanics. The design decisions below encode that boundary explicitly, so a richer look never smuggles game-y behavior back in.

| Reference trait | Adopt | Reason |
|---|---|---|
| Deep dark background, layered surfaces | Yes | Modern, focused, reads as considered. |
| One vivid accent + glow | Yes, restrained | Depth and focus without carnival. |
| Glassmorphism / elevated cards | Yes | Signature of the reference's polish. |
| Monospace terminal-style labels | Yes | Fits our "system" step names and tags cleanly. |
| Confident type scale, generous spacing | Yes | Directly fixes the "flat column" problem. |
| Subtle motion / transitions | Yes, functional only | State clarity, never celebration. |
| Hype copy, urgency, "STATUS: OPTIMAL" | No | Violates PRD voice (§4.2, §17). |
| Scores, ratings, badges, reward fills | No | Violates PRD §4.1, §17.1. |

## Design system (tokens)

All values are CSS custom properties on `:root`. Naming mirrors the reference's dark, layered approach.

### Color

```
--bg:            #0b0f14   /* app background, near-black with cool tint */
--surface-1:     #12181f   /* base card / bubble surface */
--surface-2:     #171f28   /* raised surface, tray, popover */
--surface-3:     #1e2833   /* hover / active elevation */
--line:          #2a3540   /* hairline borders */
--line-soft:     #212a33   /* subtle dividers */

--ink:           #eef3f7   /* primary text */
--muted:         #9fb0bd   /* secondary text */
--dim:           #6b7c89   /* tertiary / captions */

--accent:        #4fd1c5   /* vivid teal-cyan primary accent */
--accent-2:      #6aa8ff   /* secondary accent for gradients/glow */
--accent-ink:    #04121a   /* text on accent fills */
--accent-soft:   rgba(79,209,197,.12)  /* accent-tinted surface */

--ok:            #4fd1c5   /* "works" verdict — same family as accent */
--near:          #e2b25a   /* "thin" verdict — warm amber */
--off:           #9fb0bd   /* "missed" verdict — neutral, NOT alarm red */
--skip:          #6b7c89   /* "not checked" — dim neutral */
```

Rationale: verdicts use neutral/warm tones, never a red "error" red for "missed", because the PRD (§9, §16.6) insists these are conversation observations, not grades. Contrast pairs are chosen to meet WCAG AA (Requirement 7.1): `--ink`/`--muted` on `--surface-1/2/3` all clear 4.5:1.

### Typography

```
--font-sans:  ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, sans-serif
--font-mono:  ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace

Type scale (fluid, clamp-based, phone-first):
--fs-display: clamp(1.6rem, 5vw, 2.2rem)   /* screen H1 */
--fs-h2:      .74rem  (uppercase, letter-spaced, mono)  /* section labels */
--fs-body:    1rem / 1.6
--fs-small:   .9rem
--fs-label:   .68rem  (uppercase, letter-spaced)        /* tags, step names */
```

The monospace family carries the "system label" role for step names, section headings, and tags — the terminal accent from the reference.

### Space, radius, elevation, motion

```
--sp-1:4px --sp-2:8px --sp-3:12px --sp-4:16px --sp-5:24px --sp-6:32px --sp-7:48px
--r-sm:10px --r-md:14px --r-lg:20px --r-pill:999px
--shadow-1: 0 1px 2px rgba(0,0,0,.4)
--shadow-2: 0 12px 40px rgba(0,0,0,.45)
--glow:     0 0 0 1px var(--accent-soft), 0 8px 30px rgba(79,209,197,.10)
--dur:180ms --ease:cubic-bezier(.2,.7,.2,1)
```

All motion is wrapped so `@media (prefers-reduced-motion: reduce)` sets `--dur: 0ms` and removes transitions (Requirement 7.4).

## Architecture

The app stays a single self-contained HTML file: inline `<style>` and `<script>`, no build step, no dependencies. The redesign is purely in the presentation layer.

```
app.html
├── <style>              ← FULL REPLACEMENT: token system + component CSS
├── <body>
│   ├── status bar        ← replaces prototype ribbon (wordmark only)
│   └── <main id="app">   ← render target (unchanged mount point)
└── <script>              ← REUSED almost verbatim from the prototype
    ├── content (WEEKENDS, PHRASES, SCENE)      ← unchanged (Req 8.4)
    ├── state (FRESH/S) + helpers               ← unchanged (Req 8.1)
    ├── logic (judge, Speech, chunk, poolFor)   ← unchanged (Req 8.2)
    ├── HTML helpers (chrome, sceneHTML,         ← EDITED: class names + markup only
    │   turnHTML, screen*, cardHTML)
    └── render + goBack                          ← unchanged wiring
```

Layering model: `--bg` (page) → `--surface-1` (cards/bubbles) → `--surface-2` (tray/popover) → `--surface-3` (hover/active). Depth communicated by elevation tokens, not by borders alone. The accent and glow are used sparingly to focus attention, never to celebrate (Req 3.2).

## Components and Interfaces

Each UI component maps to an existing render function; the interface between logic and view is unchanged — the same functions return HTML strings, only their classes/markup differ. `render()` still swaps `#app.innerHTML` and rebinds listeners.

| Component | Source function | Change |
|---|---|---|
| App shell + step tracker | `chrome(inner)` | New status bar; tracker restyled as quiet map |
| Scene briefing card | `sceneHTML()` | Elevated card, mono micro-labels |
| Chat bubble | `turnHTML(who,fr,en)` | Distinct Alex/You styles, mono speaker label |
| Setup screen | `screenStart()` | Selectable cards, mono tags, calm not-in-demo box |
| Choose screen | `screenPick()` | Scene card + bubble + choice cards |
| Read screen | `screenRead()` | Transcript styling, English toggle, word-card affordance |
| Build screen | `screenBuild()` | Tray/pool/chip states, calm feedback + reveal |
| Say-it screen | `screenSay()` | Input, SVG mic toggle, verdict cards, coach/reveal |
| Done screen | `screenDone()` | Evidence hero (no number), lists, forward-look note |
| Word-card popover | `cardHTML()` | Bottom sheet with elevation and mono source labels |

No new JS interfaces, props, or events are introduced. Event wiring in `render()` (data-attributes: `data-level`, `data-src`, `data-w`, `data-card`, `data-drop`, `data-chip`, and ids `begin/next/toggle/back/...`) is preserved so the redesign is drop-in.

## Data Models

No data model changes. The existing shapes are retained exactly (Req 8.1, 8.4):

- **State `S`** (`FRESH()`): `screen, level, source, key, i, built[], checked, buildTries, buildShown, draft, heard, interim, recording, verdict, tries, revealed, hinted, showEn, results[], said[], card, mine{}`. Presentation reads these; it does not add or rename fields.
- **Content**: `WEEKENDS{key:{label,en,turns:[[who,fr,en],...]}}`, `PHRASES{phrase:{en,note}}`, `SCENE{where,you,them,want,done}` — all unchanged.
- **Verdict** (from `judge`/`/api/match`): `{kind: "ok"|"near"|"off"|"skip", note, suggest[], structure}`. The redesign maps `kind` to a color family + heading + glyph; it does not change the values.

The only additions are **CSS design tokens** (documented above), which are style data, not application data.

## Layout and structure

- App container: centered column, `max-width: 560px` (phone-first; comfortable on desktop, never stretched — Requirement 4.2), horizontal padding scaling with viewport.
- A thin top **status bar** replaces the prototype ribbon: an app wordmark on the left and the step-tracker "map" beneath the title. No dev-facing text (Requirement 2.1).
- Vertical rhythm driven by the space tokens, not ad-hoc margins, so screens share a consistent cadence (fixes "flat column").

### Step tracker ("map, not reward")

- A horizontal row of segments, one per stage (Set up · Choose · Read · Build · Say it · Done).
- States: `done` (accent hairline, filled dot), `on` (accent text + underline/glow), `upcoming` (dim). It shows *position and length only*.
- No progress-bar fill animation, no checkmark celebration, no chime (Requirement 3.2, 3.3). Reduced-motion safe.

## Component redesign

Each maps directly to the existing render functions; only markup classes and CSS change.

### 1. Setup screen (`screenStart`)
- Display H1 as the promise line, muted sub-line.
- Level and source options become elevated selectable cards with a clear `selected` state (accent border + `--accent-soft` fill + a small mono "SELECTED" affordance is avoided — instead a subtle accent ring, since "selected" is state not reward).
- `in demo` / `not in demo` tags use the mono label token; `not in demo` cards render at reduced opacity with a clear, calm explanation box (existing copy retained).

### 2. Choose screen (`screenPick`)
- Scene rendered as an elevated "briefing" card with the five parts (where / you are / talking to / you want / going well when) using mono micro-labels and readable body — this is the scene-setting the PRD (§6.3) treats as load-bearing.
- Alex's opening line as a chat bubble matching the Read screen styling for continuity.
- The three weekend choices as tappable cards.

### 3. Read screen (`screenRead`) — signature
- Chat transcript with two clearly distinct bubble styles:
  - **Alex** (left): `--surface-1`, hairline border, tail on bottom-left.
  - **You/Jamie** (right): `--accent-soft` tint, accent-leaning border, tail on bottom-right.
- Speaker label in mono above each bubble.
- English gloss appears as a quieter line inside the bubble, toggled by a clearly styled "Show/Hide English" ghost button.
- Word-card affordance: underlined dotted accent, obvious it is tappable but not noisy.

### 4. Build screen (`screenBuild`) — signature
- **Tray**: dashed-to-solid elevated dropzone; when empty shows a mono hint; placed chips are filled accent-soft chips with a clear "remove" affordance.
- **Pool**: neutral chips; `disabled` (spent) at low opacity; `hint` chip uses the amber `--near` ring (not celebratory, just guidance).
- Feedback ("Right so far" / "Not that opener" / "Not the order") in a calm info card with mono heading, plus the tries-left count (a functional count, not a score — allowed because it is remaining attempts, not ability).
- Reveal-after-three-tries in a distinct muted card.

### 5. Say-it screen (`screenSay`) — signature
- The pending "your turn" bubble as a dashed placeholder in the You style.
- Textarea styled as an elevated input; mic button as a clear toggle (recording = accent state). Replace emoji-only icons with an inline SVG mic + text label for clarity and consistency (Requirement 5.3), keeping accessible names.
- Feedback card keyed by verdict color family:
  - `ok` → accent/teal calm card, heading "That keeps it going".
  - `near` → amber card, "That works, but it's a dead end".
  - `off` → neutral card, "That doesn't answer it".
  - `skip` → dim card, "Not checked".
  - Each verdict pairs color with a distinct heading + small mono glyph so color is never the only signal (Requirement 7.3).
- Coach notes (`Try using` / `Or add`) as inline chips/labels; reveal ("One way a French speaker put it") in a quiet elevated sub-card.

### 6. Done screen (`screenDone`)
- The plain-language can-do statement as the hero, in an elevated accent-edged panel — **no number, no fraction** (Requirement 5.4, 3.1).
- "What you said" list: each item pairs the learner's own sentence (primary) with the native version (muted). This is the evidence.
- "Phrases worth keeping" and "Sentences you wrote" as clean list cards.
- The "what the next conversation would do" note retained as a calm forward-look, styled as an info card — not a call-to-action hype block.

### Word-card popover (`cardHTML`)
- Sticky bottom sheet on `--surface-2` with `--shadow-2`, rounded top, accent hairline.
- Phrase + gloss heading (mono/accent), usage examples as small cards with a mono source label, and the "write your own" textarea.

## Interactive states (Requirement 6)

A shared state model applied to all interactive elements:

| State | Treatment |
|---|---|
| default | token surface + hairline |
| hover (pointer) | elevate to `--surface-3`, border to accent-soft |
| focus-visible | 2px accent outline offset (keyboard) |
| active/pressed | slight scale (0.98) + darker surface, reduced-motion safe |
| selected | accent ring + `--accent-soft` fill |
| disabled | reduced opacity, no pointer events, no hover |

## Accessibility (Requirement 7)

- Contrast: all text/surface pairs validated against WCAG AA; verdict text sits on tinted surfaces chosen to keep 4.5:1.
- Keyboard: every button/toggle/chip is a real `<button>` (already true in the prototype), gets `:focus-visible` styling; the word-card and mic expose text names.
- Non-color signals: verdicts and chip states carry text/heading/shape in addition to color.
- Reduced motion: `prefers-reduced-motion` disables transitions and any translate/scale.

Note: full WCAG conformance requires manual testing with assistive tech and expert review; this design targets AA contrast and keyboard operability as verifiable in-code.

## Technical approach

- **New file** `app.html`, cloned from the prototype, so the original stays as reference (Requirement 8.3). Server already serves any static file; it can be opened at `/app.html`, and optionally `DEFAULT` in `server.js` can point to it (out of scope unless requested).
- **Keep the JS logic** (state machine, `judge`, `Speech`, `chunk`, `poolFor`, `render`, `goBack`) essentially unchanged. Edits are limited to:
  - the `<style>` block (full replacement with the token system),
  - the small HTML-producing helpers (`chrome`, `sceneHTML`, `turnHTML`, screen functions, `cardHTML`) for class names and structure,
  - removal of the ribbon element and dev copy.
- **No new dependencies.** Inline SVG for the mic icon; system font stack (optionally a webfont like Inter via a single `<link>` if desired — decided in tasks, default is system stack to keep it dependency-free and offline-safe).
- **Verification**: since there is no build/test harness (package.json has only `start`/`check-key`), verification is manual — run `npm start`, open `/app.html`, walk the full flow on a narrow and wide viewport, and confirm no scores/celebration and no dev copy appear.

## Correctness Properties

These are the invariants the redesign must never violate, expressed so they can be checked by inspection during verification:

### Property 1: No ability number

No score, fraction, percentage, XP, level, or streak appears in any rendered screen (PRD §4.1, §17.1). The Build "tries left" count is remaining attempts, not ability, and is the only permitted count.

**Validates: Requirements 3.1, 5.4**

### Property 2: No celebration

No confetti, chime, reward fill, or success animation fires on any step completion (PRD §17.1).

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 3: No invented French

Every French string rendered originates from `WEEKENDS`/`PHRASES`; the redesign adds no French copy (PRD §16.4).

**Validates: Requirements 8.4**

### Property 4: No internal vocabulary as labels

None of the §5 terms (Mission, Capability, Learning Evidence, Difficulty Ramp, Word Card, Review, Capability Check) appear as UI labels.

**Validates: Requirements 2.2, 2.3**

### Property 5: Behavior parity

For any given state `S`, the redesigned screens present the same information and offer the same actions as the prototype; only styling and markup differ.

**Validates: Requirements 8.1, 8.2**

### Property 6: Color is never the sole signal

Every state distinguished by color also carries text or shape (Req 7.3).

**Validates: Requirements 6.3, 7.3**

## Error Handling

Presentation-only work, so error handling is inherited unchanged from the prototype and simply restyled:

- **Matcher unavailable / no key / over budget**: `judge` already returns `kind:"skip"` with an English note. The redesign renders this as the calm `skip` verdict card — never as an error or failure, per PRD §9.
- **Speech unsupported (Firefox/Safari)**: existing `alert` fallback retained; the mic control still renders and the typed path is unaffected (PRD §9).
- **Empty/short attempt**: existing disabled-until-input behavior on the Check/Verify buttons is preserved via the `disabled` state styling.
- No new failure modes are introduced because no new logic is added.

## Testing Strategy

There is no automated test harness in the repo (package.json exposes only `start` and `check-key`), so verification is manual and checklist-driven:

1. **Flow walk**: `npm start`, open `/app.html`, complete Set up → Choose → Read → Build → Say it → Done for each of the three weekends.
2. **Viewport check**: repeat at a phone width (~375px) and a desktop width; confirm single-column comfort and no stretched line lengths.
3. **Behavior parity**: confirm matcher verdicts, speech toggle, chunk assembly (including 3-try reveal), word-card popover, English toggle, and Back navigation all behave as in the prototype.
4. **Principle audit**: scan every screen against the Correctness Properties above — no numbers, no celebration, no dev copy, no internal-vocabulary labels.
5. **Accessibility spot-check**: keyboard-tab the full flow for visible focus; verify AA contrast on sampled text/surface and verdict pairs; toggle `prefers-reduced-motion` and confirm animation is disabled.

Manual verification is sufficient here because the change surface is CSS + markup strings with no branching logic added. Full WCAG conformance still requires assistive-tech testing and expert review beyond this pass.

## Out of scope

- Changing content, French lines, phrases, or scenes.
- Changing the flow, matcher prompt, or scoring logic.
- Building the "bring your own", A1/B1 levels, or the second conversation (§13, §17.4) — those are product work, not polish.
- Persistence, accounts, notifications.
