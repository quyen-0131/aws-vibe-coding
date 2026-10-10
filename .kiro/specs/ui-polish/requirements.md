# Requirements Document

## Introduction

The product (a French practice app for busy adults, defined in `PRD.md` and `CONTEXT.md`) has a working prototype in `weekend-mission-prototype.html`. The flow is correct and the content is settled; the visual craft is not. This spec covers a focused visual and interaction polish pass on that reference prototype.

The stated design reference is [pixelrise.ai](https://pixelrise.ai/) — a modern, dark, high-craft "command center" aesthetic (deep backgrounds, a vivid accent, glassmorphism cards, quiet monospace system-labels, subtle glow and motion, confident type and spacing).

### The core tension, stated up front

PixelRise is a high-energy sales landing page. Our PRD is deliberately calm, honest, and anti-game-y (§4 principles, §17 "what this is deliberately not"). A literal copy would fight the product. So this spec adopts the **craft** of the reference — depth, polish, refined type and spacing, restrained glow, tasteful motion, modern card treatment, monospace system-labels — while refusing the parts that violate our principles: no celebration, no scores, no reward animations, no hype. Every requirement below is written so the reference informs *how things look and feel*, never *what the product claims or rewards*.

## Glossary

- **Reference**: [pixelrise.ai](https://pixelrise.ai/), the visual style being emulated.
- **Design token**: a named CSS custom property for a color, spacing, radius, or motion value.
- **Signature screens**: Read, Build, Say-it, and Done — where the learner spends the most time.
- **Verdict**: the conversation observation shown after a say-it attempt (works / thin / missed / not checked). Not a grade.
- **Step tracker**: the row of stage labels showing position in the flow; a map, never a reward (PRD §17.1).
- **PRD**: `PRD.md` in the workspace root. **CONTEXT**: `CONTEXT.md`, the domain vocabulary.

## Requirements

### Requirement 1: Adopt a coherent dark command-center visual system

**User Story:** As a learner, I want the app to look like a considered, modern product, so that I trust it with the evidence of my ability.

#### Acceptance Criteria

1. WHEN any screen renders THEN the system SHALL use a single defined design system: a deep dark background, layered surface elevations, one vivid accent color, and a defined type scale — all expressed as CSS custom properties.
2. WHEN text is displayed THEN the system SHALL use a confident type scale with clear hierarchy (display, heading, body, label) and adequate line-height for reading.
3. WHERE a small "system" label appears (step names, section headings, source/level tags) THE system SHALL render it in a monospace or letter-spaced uppercase treatment consistent with the reference's terminal-style labels.
4. WHEN surfaces (cards, bubbles, trays) render THEN the system SHALL apply consistent corner radii, borders, and subtle depth (soft shadow and/or faint inner glow), avoiding flat monochrome boxes.
5. IF a color or spacing value is used more than once THEN it SHALL be defined as a design token, not hard-coded inline.

### Requirement 2: Remove developer-facing and internal-vocabulary content from the learner's view

**User Story:** As a learner, I want to see only what is meant for me, so that the product feels finished and speaks my language.

#### Acceptance Criteria

1. WHEN the app loads THEN the system SHALL NOT display the prototype ribbon ("every French line here is yours · nothing generated") or any developer-facing note.
2. WHEN any screen renders THEN the system SHALL NOT surface internal vocabulary as labels (per PRD §5): no "Mission", "Capability", "Learning Evidence", "Difficulty Ramp", "Word Card", "Review", "Capability Check".
3. WHERE a design token or code comment references internal vocabulary THE comment MAY retain it (internal use is allowed by §5), but the rendered UI SHALL NOT.

### Requirement 3: Preserve product principles while restyling

**User Story:** As the product owner, I want the polish to respect the PRD, so that a nicer look does not quietly reintroduce the mechanics we chose to avoid.

#### Acceptance Criteria

1. WHEN a screen ends or a step completes THEN the system SHALL NOT display any score, fraction, percentage, XP, level indicator, or streak (PRD §4.1, §17.1).
2. WHEN a step or attempt succeeds THEN the system SHALL NOT play a celebratory animation, chime, confetti, or reward fill (PRD §17.1 — "a map, never a reward").
3. WHEN the step tracker renders THEN it SHALL communicate position and length only, as a quiet progress map, without reward styling.
4. WHEN motion is used THEN it SHALL be restrained and functional (state transitions, focus, tap feedback), never celebratory.
5. WHERE the reference uses hype or urgency THE system SHALL NOT reproduce it; copy remains calm and honest per the PRD voice.

### Requirement 4: Phone-first responsive layout

**User Story:** As a learner practising in fifteen stolen minutes on my phone, I want the app to feel built for my thumb, so that it is comfortable in the context it is actually used (PRD §11, §13.2).

#### Acceptance Criteria

1. WHEN viewed on a phone-width viewport THEN the system SHALL present a single comfortable column with touch targets of at least 44px in the interactive height.
2. WHEN viewed on a desktop-width viewport THEN the system SHALL remain usable and centered without stretching line lengths beyond comfortable reading.
3. WHEN interactive elements (chips, buttons, options) render THEN spacing SHALL be sufficient to tap reliably without mis-hits.
4. WHEN the on-screen keyboard is likely open (say-it text entry) THEN primary actions SHALL remain reachable.

### Requirement 5: Polish the four signature screens

**User Story:** As a learner, I want the screens I spend the most time on to feel crafted, so that the experience is pleasant end to end.

#### Acceptance Criteria

1. WHEN the Read screen renders THEN chat bubbles SHALL have clear speaker distinction (you vs Alex), refined bubble styling, readable inline word-card affordances, and a clean English toggle.
2. WHEN the Build screen renders THEN the chunk tray and chip pool SHALL be visually distinct, with clear states for available, placed, disabled, and hint chips, and legible diverge/feedback messaging.
3. WHEN the Say-it screen renders THEN the attempt input, mic control, and feedback card (works / thin / missed / not checked, plus coach notes and reveal) SHALL be clearly differentiated and calm.
4. WHEN the Done screen renders THEN it SHALL present the learner's own sentences as the evidence, phrases worth keeping, and any sentences they wrote — with no number, score, or fraction anywhere.
5. WHERE a word-card popover appears THE system SHALL style it as a clean, elevated sheet consistent with the design system.

### Requirement 6: Refine interactive states and feedback

**User Story:** As a learner, I want the interface to respond clearly to my actions, so that I always know what happened.

#### Acceptance Criteria

1. WHEN an interactive element receives hover, focus, active, or disabled state THEN the system SHALL provide a distinct, accessible visual treatment for each.
2. WHEN a chip is tapped into or out of the tray THEN the change SHALL be visually immediate and unambiguous.
3. WHEN feedback verdicts render (ok / near / off / skip) THEN each SHALL be visually distinguishable through the design system without implying a grade or score.
4. WHEN focus moves via keyboard THEN a visible focus indicator SHALL be present on all interactive elements.

### Requirement 7: Accessibility and legibility

**User Story:** As any learner, I want the redesign to remain readable and operable, so that a darker, richer look does not cost usability.

#### Acceptance Criteria

1. WHEN text renders on any surface THEN foreground/background contrast SHALL meet WCAG AA for body text (4.5:1) and large text (3:1).
2. WHEN interactive elements render THEN they SHALL be operable by keyboard and expose accessible names.
3. WHEN color communicates state (verdicts, chip states) THEN color SHALL NOT be the only signal; text or shape SHALL also carry the meaning.
4. WHERE motion is used THE system SHALL respect `prefers-reduced-motion` and disable non-essential animation.

### Requirement 8: Preserve existing behavior and structure

**User Story:** As the product owner, I want the polish to change only presentation, so that the settled flow and content stay intact.

#### Acceptance Criteria

1. WHEN the redesign is applied THEN the flow (Set up → Choose → Read → Build → Say it → Done) and its state machine SHALL behave as before.
2. WHEN the Gemini matcher, speech recognition, chunking, and back-navigation run THEN they SHALL function unchanged.
3. WHEN the redesign is delivered THEN the original `weekend-mission-prototype.html` SHALL remain intact as a reference, and the polished version SHALL live in a separate file.
4. WHEN French content, phrases, and scenes render THEN they SHALL match the existing content exactly (no invented French — PRD §16.4).
