# Responsive "website" layout for app.html by viewport width

The change promotes the wide web-app layout that was previously gated behind `body.demo` so it also applies on wide viewports (≥900px shell, ≥1000px two-pane) in the real app, while keeping the phone-first narrow column below those breakpoints and leaving demo mode untouched. The approach mirrors the existing `body.demo` rules into two new viewport-scoped `@media` blocks (reusing the same declaration bodies with non-demo selectors) and flips a single predicate in `syncDemoClass()` so the `demowide` class is toggled by screen (`build`/`say`) alone rather than by demo state. It is a presentation-only change: no mission flow, reminder engine, or Gemini matcher logic is touched. Watch for: the deliberate 900px-vs-820px `.opts` breakpoint asymmetry between the viewport and demo paths (confirmed, intentional/documented), and that the viewport two-pane relies on the JS predicate change to add `demowide` outside demo (confirmed wired correctly).

**Verdict**: APPROVED

## High-level view

The wide look is produced by two `@media` blocks appended immediately after the corresponding `body.demo` blocks. The ≥900px block widens the shell (`max-width:1120px`), widens `main` padding, and gives `.opts` two columns; it deliberately omits the projector-sized type bumps so desktop reads as a website rather than a presentation. The ≥1000px block repeats the demo two-pane grid verbatim with non-demo selectors (`main.demowide`, `#app:has(#next)`, `.bub`). Demo mode keeps its own unconditional `body.demo` rules so it stays wide at every width; the media blocks add the same look for wide viewports in or out of demo, and because both paths target the same declarations there is no specificity fight.

The two-pane trigger is the one JS change: `syncDemoClass()` now computes `twoPane` from `S.screen === "build" || S.screen === "say"` with no `DEMO.on` guard, so the `demowide` class lands on `#app` on those two screens regardless of demo. Scoping is preserved — `demowide` is still only added on build/say, READ is still selected by `#app:has(#next)`, and setup/pick/settings never match either selector, so the grid cannot leak onto the option screens.

The breakpoints are not symmetric between the two paths: the viewport `.opts` two-column rule fires at 900px while demo's stays at the pre-existing 820px. This is intentional and documented in a CSS comment, aligning the non-demo two-column `.opts` with the shell-widen breakpoint; demo behavior is unchanged.

<details>
<summary>Issues (1)</summary>

1. **`.opts` breakpoint asymmetry (900px vs 820px)** — the viewport path uses 900px for two-column `.opts` while the demo path keeps 820px; intentional and documented, non-blocking. No action required unless a single consolidated breakpoint is preferred.

</details>

<details>
<summary>Details</summary>

### Share mechanism: mirrored media blocks, not a reimplementation

The requirement to reuse the existing `body.demo` CSS rather than reimplement it is met. The ≥900px shell block and the ≥1000px two-pane block are placed directly after their `body.demo` counterparts and carry the identical declaration bodies — the ≥1000px grid repeats `display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:var(--sp-6);align-items:start;column-gap:clamp(var(--sp-5),4vw,var(--sp-7))}` and the same full-width / left / right column assignments, swapping only the `body.demo ` prefix for the bare selector. The mechanism is documented in CSS comments on both new blocks, which explicitly state they mirror the demo rules and that demo keeps its own unconditional rules so it stays wide at all widths (confirmed, lines 248–254 and 300–305).

This "share by mirroring the declaration body behind a viewport media query" is not literal rule reuse (the declarations are duplicated, not referenced), but it is the correct call here: demo must stay wide at *all* widths via its non-media `body.demo` rules, while the viewport variant must be gated behind `@media (min-width:...)`. A single shared selector list cannot express both triggers without pulling demo's always-on width into a media query. The duplication is the intended design and is called out in the comments.

### Type scale excluded from the viewport path

The ≥900px block widens layout only — `max-width:1120px`, `main` padding, `.opts` columns — and omits the demo type bumps (`font-size:1.18rem` on body, `clamp(2.2rem,4vw,3.2rem)` h1, the 1.1rem component bumps), which remain demo-only under the untouched `body.demo` rules. Had the block copied those bumps it would have put projector-sized type on every desktop browser; the recorded 1280px evidence confirms website-sized clamp() type instead.

### Two-pane trigger and scoping

```
syncDemoClass():
  twoPane = (S.screen === "build" || S.screen === "say")   // was: DEMO.on && (...)
  app.classList.toggle("demowide", twoPane)
  body.classList.toggle("demo", !!DEMO.on)                 // unchanged
```

The `demowide` class is now added on build/say for every render regardless of demo, but the grid only renders where a ≥1000px media block defines it. Setup/pick/settings never set `demowide` and have no `#next`, so neither the `main.demowide` grid nor the `#app:has(#next)` READ rule can match them — scoping is identical to what demo already proved correct, so the grid cannot leak onto the option screens. The `body.demo` toggle line is untouched, so demo state still drives the ribbon and amber styling independently. This is the only JS change in the diff.

Below 1000px the class is present on `#app` but inert — no media block defines `main.demowide{display:grid}` there — so the phone column is unaffected, which the narrow (≤526px) computed-style evidence confirms (`display:block`, `grid-template-columns:none`) even with `demowide` applied.

### Breakpoint asymmetry (non-blocking)

The viewport `.opts{grid-template-columns:1fr 1fr}` fires at 900px; the demo `.opts` rule stays at the pre-existing 820px. In the 820–899px band a demo user sees two-column options while a non-demo user still sees one column. This is intentional (the comment and plan note the 900px choice aligns with the shell-widen breakpoint) and demo behavior is unchanged, so it is not a regression — just an asymmetry a reviewer should be aware of. The plan flags 900px-for-both as an optional consolidation.

### Demo coexistence

With both triggers active (demo on, wide viewport), the shell max-width, two-pane grid, and `.opts` columns resolve to the same declarations in both paths, so the triggers compose rather than compete. The recorded demo-mode evidence at 1254px confirms ribbon visible, `bodyDemo:true`, wide shell, two-column `.opts`, and the two-pane grid on build all intact.

### Integrity: IDs, hooks, reduced-motion

Element IDs (`#app`, `#next`, `#reminderlink`, demo ribbon hooks) are referenced unchanged by the new selectors; no IDs were renamed or removed. The `@media (prefers-reduced-motion:reduce)` block (line 213) sits above the new blocks and is untouched. The new blocks add only layout declarations (grid, max-width, padding, column assignment) with no animation or transition properties, so they do not reintroduce motion for reduced-motion users.

### Verification evidence

The plan's Verification section records `npm test` → 192 passing / 0 failing (baseline match for a layout-only change), `npm start` → HTTP 200, and headless-Chrome computed-style checks at three width bands in demo and non-demo: wide non-demo (1254px) shows `main` max-width 1120px with two-column `.opts` on start/pick, no grid on read, and the two-pane grid on build/say with `demowide` applied; narrow (526px) stays single-column with the grid inert even when `demowide` is set; demo (1254px) keeps ribbon + wide shell + two-pane. This directly exercises every checklist item — narrow unchanged, wide two-pane scoped to build/say/read, option screens excluded, demo coexistence — so no re-run is warranted. The evidence is specific (per-screen computed `display`, `grid-template-columns`, and `max-width` values) and leaves no articulable doubt requiring a spot-check.

</details>

<details>
<summary>File map</summary>

- `app.html` — second `<style>` block: added `@media (min-width:900px)` shell block (max-width/padding/`.opts`) and `@media (min-width:1000px)` two-pane block mirroring the `body.demo` rules with non-demo selectors; both documented via CSS comments. In `<script>`: `syncDemoClass()` `twoPane` predicate changed to screen-only (dropped `DEMO.on &&`), comment updated.

</details>
