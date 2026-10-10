# Implementation Plan — UI/UX Polish

## Overview

A presentation-only redesign of the reference prototype into a new `app.html`, adopting the craft of the pixelrise.ai aesthetic (dark command-center look) while preserving the PRD's calm, anti-game-y principles. Work proceeds bottom-up: tokens and shell first, then shared components, then the six screens, then an accessibility and full-flow verification pass. No application logic changes.

## Tasks

- [ ] 1. Scaffold the polished file and design tokens
  - Clone `weekend-mission-prototype.html` to a new `app.html`, leaving the original untouched
  - Remove the prototype ribbon and any developer-facing copy from the markup
  - Replace the `<style>` block's `:root` with the full token system (color, type, space, radius, elevation, motion) from the design
  - Add base styles: dark `--bg`, `--font-sans`/`--font-mono`, centered phone-first container (max-width 560px), and the `prefers-reduced-motion` guard
  - _Requirements: 1.1, 1.5, 2.1, 2.3, 4.2, 7.4, 8.3_

- [ ] 2. Build the app shell and step-tracker "map"
  - Restyle the top area into a calm status bar (wordmark only, no dev text)
  - Rebuild the step tracker (`chrome`) as a quiet position/length map with done/on/upcoming states, mono labels, no fills or celebration
  - Restyle the Back button as a consistent ghost control
  - _Requirements: 1.3, 3.2, 3.3, 6.1_

- [ ] 3. Establish shared component styles and interactive states
  - Define reusable classes for buttons (primary/ghost), selectable option cards, chips, inputs, and info cards
  - Implement the full state model: default, hover, focus-visible, active, selected, disabled
  - Ensure all touch targets meet ~44px and spacing prevents mis-taps
  - _Requirements: 1.4, 4.1, 4.3, 6.1, 6.2, 7.2, 7.4_

- [ ] 4. Restyle the Setup screen (`screenStart`)
  - Display promise H1 + muted sub-line
  - Level and source as elevated selectable cards with clear selected state
  - `in demo` / `not in demo` mono tags; dim + calm explanation for not-in-demo choices (retain existing copy)
  - _Requirements: 1.1, 1.2, 1.3, 6.1, 8.1_

- [ ] 5. Restyle the Choose screen (`screenPick`)
  - Scene as an elevated "briefing" card with the five parts and mono micro-labels (`sceneHTML`)
  - Alex's opening line as a chat bubble matching Read styling
  - Three weekend choices as tappable cards
  - _Requirements: 1.4, 5.1, 8.1_

- [ ] 6. Restyle the Read screen chat transcript (`screenRead`, `turnHTML`)
  - Distinct Alex (left) vs You (right) bubble styles with mono speaker labels and tails
  - English gloss as a quieter in-bubble line; clean Show/Hide English toggle
  - Dotted-accent tappable word-card affordance
  - _Requirements: 1.4, 5.1, 6.3, 7.3_

- [ ] 7. Restyle the Build screen (`screenBuild`)
  - Tray dropzone (empty hint vs placed chips with remove affordance)
  - Pool chips with available / disabled / hint states (amber ring for hint, not celebratory)
  - Calm feedback card with mono heading and tries-left count; distinct reveal-after-three card
  - _Requirements: 1.4, 5.2, 6.2, 6.3, 7.3, 8.2_

- [ ] 8. Restyle the Say-it screen (`screenSay`)
  - Pending "your turn" dashed placeholder bubble; elevated textarea input
  - Replace emoji mic with inline SVG mic + text label; clear recording toggle state with accessible name
  - Verdict feedback cards (ok / near / off / skip) keyed by color family + distinct heading + mono glyph so color is not the only signal
  - Coach notes and reveal sub-card styled per design
  - _Requirements: 1.4, 5.3, 6.3, 7.2, 7.3, 8.2_

- [ ] 9. Restyle the Done screen (`screenDone`)
  - Can-do statement hero panel with NO number, fraction, or score
  - "What you said" evidence list (learner sentence primary, native version muted)
  - "Phrases worth keeping" and "Sentences you wrote" list cards
  - Retain the forward-look note as a calm info card, not a hype CTA
  - _Requirements: 3.1, 5.4, 8.1, 8.4_

- [ ] 10. Restyle the word-card popover (`cardHTML`)
  - Bottom sheet on `--surface-2` with elevation and accent hairline
  - Phrase + gloss heading, usage examples with mono source labels, "write your own" textarea
  - _Requirements: 1.4, 5.5, 6.1_

- [ ] 11. Accessibility and reduced-motion pass
  - Verify WCAG AA contrast for all text/surface and verdict pairs; adjust tokens if any pair fails
  - Confirm keyboard operability and visible focus on every interactive element
  - Confirm `prefers-reduced-motion` disables non-essential animation
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 12. Full-flow verification and principle check
  - Run `npm start` and walk Set up → Choose → Read → Build → Say it → Done on narrow and wide viewports
  - Confirm behavior unchanged: matcher, speech, chunking, Back navigation, content exact
  - Confirm no scores/fractions/streaks, no celebration animations, and no developer-facing or internal-vocabulary text anywhere in the UI
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.4, 8.1, 8.2, 8.4_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"], "description": "Scaffold new file, remove dev copy, install token system" },
    { "wave": 2, "tasks": ["2", "3"], "description": "App shell + step tracker and shared component/state styles (depend on 1)" },
    { "wave": 3, "tasks": ["6"], "description": "Read-screen bubble styling first, since Choose reuses it" },
    { "wave": 4, "tasks": ["4", "5", "7", "8", "9", "10"], "description": "Remaining screens and popover (depend on 3; 5 depends on 6)" },
    { "wave": 5, "tasks": ["11"], "description": "Accessibility and reduced-motion pass (depends on 4-10)" },
    { "wave": 6, "tasks": ["12"], "description": "Full-flow verification and principle audit (depends on 1-11)" }
  ]
}
```

- Task 1 blocks everything (tokens are the foundation).
- Tasks 2 and 3 depend only on 1 and can be done in either order.
- Screen tasks 4–10 depend on 3 (shared component styles) and are largely independent of each other; task 5 (Choose) reuses the bubble style introduced in task 6 (Read), so do 6 before or with 5.
- Task 11 depends on all screens existing (4–10).
- Task 12 is the final gate and depends on 1–11.

## Notes

- Deliverable is a new `app.html`; the original `weekend-mission-prototype.html` stays as a reference (Requirement 8.3).
- No new dependencies; system font stack by default. Adding a webfont (e.g. Inter) is optional and, if chosen, added in task 1.
- No automated tests exist in the repo, so task 12 is a manual checklist walk against the design's Correctness Properties.
- Optionally point `DEFAULT` in `server.js` to `app.html` once polished — deferred; not part of this spec unless requested.

