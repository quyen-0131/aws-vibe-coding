# Implementation Plan — Responsive "website" layout for app.html

## Goal

Promote the existing wide "web-app layout" (currently gated behind `body.demo`) so it
also applies responsively on wide viewports, while keeping the phone-first narrow column
on small screens and leaving demo mode behaving exactly as before. Presentational change
only — no mission flow, reminder engine, or matcher logic changes.

All UI lives in one file: `d:\Documents\ChatGPT\AWS Vibe coding\app.html`. The active
visual layer is the SECOND `<style>` block in `<head>`. The server (`server.js`) serves
it at `http://localhost:8777/app.html` on port 8777 (`npm start`, which runs
`node --env-file=.env.local server.js`).

## Key facts established by reading the code

- `<main id="app">` IS the `<main>` element. The JS-added `demowide` class lands on
  `#app`, so `main.demowide` and `#app.demowide` are the same element.
- Screen order constant: `const ORDER = ["start","pick","read","build","say","done"]`,
  plus a non-flow `"settings"` screen. `SCREENS` maps each to its render fn.
- The READ screen is uniquely identifiable by `#app:has(#next)` — the "I've read it →"
  button has `id="next"` and exists only on `screenRead()`.
- The BUILD and SAY screens get the two-pane grid via the `demowide` class, added in
  `syncDemoClass()` (around line 719) ONLY when `DEMO.on && (S.screen==="build" || S.screen==="say")`.
- `syncDemoClass()` is called from both `render()` (line ~1343) and `setDemo()` (line ~734),
  so changing it is sufficient and consistent across every render.
- The setup/options screens (`start`, `pick`, `settings`) never get `demowide` and have no
  `#next` button, so the two-pane grid will correctly NOT apply to them.

## Selectors currently gated behind `body.demo` (second `<style>` block)

These are the exact rules to share with a viewport media query (line numbers approximate):

Shell / type / spacing (the `body.demo{...}` block, ~lines 230–245):
- `body.demo` — background radius bump + `font-size:1.18rem`
- `body.demo .demobar, body.demo .reminder, body.demo #reminderlink, body.demo main` — `max-width:1120px`
- `body.demo h1`, `body.demo h2`, `body.demo .lede`
- `body.demo .scene, .opt, .bub, .verdict, .said, .done-panel` — `font-size:1.1rem`
- `body.demo .steps div`, `body.demo .steps div::before`
- `body.demo textarea`
- `body.demo .go, .ghost, .mic`
- `body.demo .chip`
- `body.demo .demonote`, `body.demo .demobtn`
- `body.demo .reminder`, `body.demo .reminder .rtitle`, `body.demo .reminder .rbody`

Medium screens (`@media (min-width:820px)`, ~lines 249–252):
- `body.demo .opts{grid-template-columns:1fr 1fr}`
- `body.demo main{padding-left/right: clamp(...)}`

Large screens two-pane (`@media (min-width:1000px)`, ~lines 258–285):
- `body.demo #app:has(#next) .turn{break-inside:avoid}` and the (currently empty) READ selector
- `body.demo .bub{max-width:88%}`
- `body.demo main.demowide{display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.05fr); ...}`
- `body.demo main.demowide > .statusbar/.steps/h1/.back/.lede{grid-column:1 / -1}`
- `body.demo main.demowide > .turn{grid-column:1}`
- `body.demo main.demowide > .tray/.pool/textarea/.row/.heard/.verdict/.bar/.cardpop{grid-column:2}`

## Design decisions

- **Breakpoint:** `min-width:900px` for the wide SHELL + two-column `.opts` + widened
  padding; keep `min-width:1000px` for the genuine two-pane read/build/say grid. Rationale:
  900px is the task's suggested range and is where a 1120px-capped shell starts to look like
  a website rather than a stretched phone; the two-pane split needs more room, so 1000px (the
  existing demo breakpoint) is reused unchanged. The demo-only `820px` `.opts` breakpoint is
  left intact for demo and the viewport variant uses 900px — documented in a CSS comment.

- **Share mechanism (chosen):** Append non-demo selector variants to the existing rule lists
  rather than writing a parallel implementation. Concretely: wrap the viewport variants in
  two new `@media` blocks placed immediately AFTER the current demo blocks, reusing the SAME
  declaration bodies but with viewport-scoped selectors (e.g. `.reminder, #reminderlink, main`
  instead of `body.demo .reminder, ...`). Demo mode keeps its own unconditional (non-media)
  `body.demo` rules so demo stays wide at ALL widths; the media blocks add the same look for
  wide viewports in or out of demo. A CSS comment documents that the two paths intentionally
  mirror each other. Rationale: zero risk to the phone-first defaults (everything new is behind
  `@media (min-width:...)`), demo rules are untouched, and the two triggers coexist without
  specificity fights because they target the same declarations.

- **Type-size bumps:** The large demo font bumps (`font-size:1.18rem` on body, 3.2rem h1,
  1.1rem components) are tuned for a projector and would be oversized on a normal desktop.
  The viewport variant will adopt the LAYOUT rules (max-width, grid, two-column `.opts`,
  padding) but NOT the aggressive demo type scale — the default responsive type already uses
  `clamp()`. This keeps a desktop browser looking like a website, not a presentation. Documented
  in a CSS comment. (Demo mode keeps its big type via its untouched `body.demo` rules.)

- **Two-pane trigger without demo (chosen option a):** Modify `syncDemoClass()` so `demowide`
  is toggled on `#app` based on screen alone: `S.screen==="build" || S.screen==="say"`,
  independent of `DEMO.on`. The CSS two-pane rules then get a viewport variant (`main.demowide`
  under `@media (min-width:1000px)`) so the grid applies on wide non-demo viewports. Scoping is
  preserved: `demowide` is still only added on build/say, and READ keeps using `#app:has(#next)`;
  setup/pick/settings never match. Rationale: one-line predicate change, reuses the exact scoping
  the demo already proved correct, and cannot leak the grid onto option screens.

## Steps

- [ ] 1. Add a viewport-scoped SHELL + components media block that mirrors the `body.demo`
      shell rules (LAYOUT only, not the big demo type scale). In the second `<style>` block,
      immediately AFTER the `body.demo .reminder .rbody{...}` rule (~line 245) and BEFORE the
      existing `@media (min-width:820px)` block, insert a new `@media (min-width:900px){ ... }`
      block containing: `.reminder, #reminderlink, main{max-width:1120px}` and the widened
      `main` left/right padding (`clamp(var(--sp-5),5vw,var(--sp-7))`), plus `.opts{grid-template-columns:1fr 1fr}`.
      Add a CSS comment stating these intentionally mirror the `body.demo` wide rules but omit
      the projector-sized type bumps, triggered by viewport width instead of the demo class.
      Note: `.demobar` max-width stays demo-only (the demo ribbon is empty/hidden outside demo),
      so it is intentionally NOT widened here.
      Files: `d:\Documents\ChatGPT\AWS Vibe coding\app.html`
      Verify: `npm start`, open `http://localhost:8777/app.html` at ≥900px wide — the start and
      pick screens use a ~1120px centered shell and `.opts` shows two columns. Resize below 900px
      — it returns to the narrow single-column phone layout unchanged. `npm test` still passes.

- [ ] 2. Add a viewport-scoped TWO-PANE media block mirroring the `body.demo` large-screen rules.
      After the existing `@media (min-width:1000px){ body.demo ... }` block (~line 285), insert a
      new `@media (min-width:1000px){ ... }` block that repeats the two-pane declarations with
      non-demo selectors: `#app:has(#next) .turn{break-inside:avoid}`, `.bub{max-width:88%}`,
      `main.demowide{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:var(--sp-6);align-items:start;column-gap:clamp(var(--sp-5),4vw,var(--sp-7))}`,
      the `main.demowide > .statusbar/.steps/h1/.back/.lede{grid-column:1 / -1}` full-width row,
      `main.demowide > .turn{grid-column:1}`, and the right-column list
      `main.demowide > .tray/.pool/textarea/.row/.heard/.verdict/.bar/.cardpop{grid-column:2}`.
      Add a CSS comment noting it mirrors the demo two-pane rules for wide viewports. Depends on
      step 3 for the class to be present outside demo, but the CSS is harmless on its own.
      Files: `d:\Documents\ChatGPT\AWS Vibe coding\app.html`
      Verify: `npm test` passes (CSS-only, no JS impact). Visual verification happens in step 3.

- [ ] 3. Make `syncDemoClass()` add `demowide` on wide non-demo viewports, scoped to build/say.
      In the classic `<script>`, change the `twoPane` predicate (~line 723) from
      `const twoPane = DEMO.on && (S.screen === "build" || S.screen === "say");` to
      `const twoPane = (S.screen === "build" || S.screen === "say");` so the class is toggled by
      screen alone. Leave the `document.body.classList.toggle("demo", !!DEMO.on)` line unchanged.
      Update the function's comment to say the two-pane grid is driven by viewport width via CSS
      media queries (step 2) and demo mode alike. Do not touch any other state, IDs, or hooks.
      Files: `d:\Documents\ChatGPT\AWS Vibe coding\app.html`
      Verify: `npm start`, open `app.html` at ≥1000px wide (NOT in demo). Advance to the Build and
      Say screens — the layout splits into two panes (context turns left, working column right).
      Open Read — it stays a readable wide column (no spurious grid). Open the Start/Choose/Settings
      screens — single-column, no two-pane grid. Resize below 1000px — build/say collapse back to a
      single column. Toggle the demo ribbon ON — demo still widens and two-panes exactly as before.
      `npm test` still passes.

- [ ] 4. Full verification pass against the checklist below; fix any regressions found.
      Files: `d:\Documents\ChatGPT\AWS Vibe coding\app.html` (only if fixes needed)
      Verify: run the entire checklist in "Verification checklist" and confirm every item.

## Verification checklist

Build/test:
- `npm test` passes (expected: 192 passing, 0 failing — unchanged from baseline, since this is a
  layout-only change and tests cover the untouched reminder/content JS).
- `npm start` serves `http://localhost:8777/app.html` without error.

Narrow viewport (phone, <900px) — must be UNCHANGED:
- Shell is the ~560px narrow centered column on every screen.
- `.opts` is a single column.
- Build/Say are single-column (no two-pane grid).
- `prefers-reduced-motion:reduce` still disables animations/transitions (block untouched).

Wide viewport (desktop, non-demo):
- At ≥900px: shell widens toward ~1120px; `.opts` shows two columns on Start/Choose; `main` padding widens.
- At ≥1000px: Build and Say render the two-pane grid (context turns left, working area right).
- Read screen is a wide single column (uses `#app:has(#next)`, `.bub` max-width 88%), not a broken grid.
- Start / Choose / Settings never show the two-pane grid.
- Desktop type is website-sized (clamp defaults), NOT the oversized projector/demo scale.

Demo mode (must still work exactly as before):
- Toggling demo on still shows the amber demo ribbon and amber styling.
- `body.demo` still widens the shell and bumps type at ALL widths (demo rules untouched).
- Build/Say still two-pane in demo; demo + wide viewport active together produce no conflicting layout.

Integrity:
- All element IDs preserved (`#app`, `#next`, `#reminderbanner`, `#reminderlink`, `#demoribbon`, etc.).
- Reminder-state hooks, demo hooks, and the first legacy `<style>` block left intact.
- No change to mission flow, reminder engine, Gemini matcher, or any behavior.

## Notes / assumptions

- `.demobar` is intentionally not widened by the viewport media query because the demo ribbon is
  empty (`#demoribbon:empty{display:none}`) outside demo mode, so its width is moot in the real app.
- The existing demo `820px` `.opts` breakpoint is left untouched; the responsive variant uses 900px
  to align with the shell-widen breakpoint. If a reviewer prefers a single breakpoint, 900px for both
  is the recommended consolidation, but it is not required.
- CSS-only visual regressions can't be caught by `node --test`; manual viewport checks at the three
  widths (≤899px, 900–999px, ≥1000px) in both demo and non-demo are the authoritative verification.

## Verification (performed)

All three code changes were applied to `app.html`:
1. New `@media (min-width:900px)` block (shell `max-width:1120px`, widened `main` padding, two-column
   `.opts`) mirroring the `body.demo` shell rules but omitting the projector-sized type bumps.
2. New `@media (min-width:1000px)` block repeating the two-pane read/build/say grid with non-demo
   selectors (`main.demowide`, `#app:has(#next)`, `.bub`).
3. `syncDemoClass()` `twoPane` predicate changed from `DEMO.on && (build|say)` to `(build|say)` so the
   `demowide` class is toggled by screen alone; the media query decides whether the grid renders.

Commands run (from repo root):
- `npm test` → **192 passing, 0 failing** (0 cancelled/skipped/todo). No regressions; matches baseline.
- `npm start` → served `http://localhost:8777/app.html`, HTTP 200.

Headless Chrome (Chrome `--headless=new`) driven via the CDP (DevTools Protocol). The app was walked
start → pick → read → build → say and computed styles read on `#app` / `.opts`. Window chrome reduces
innerWidth below the nominal `--window-size`, so the effective innerWidth is noted per run.

Wide, NON-demo (innerWidth 1254px, `bodyDemo:false` throughout):
- start: `main` max-width `1120px`, `display:block`, `.opts` grid `506px 506px` (two columns), no `demowide`.
- pick: same wide shell, `display:block`, `.opts` two columns.
- read: wide shell, `display:block` (no spurious grid), `demowide` NOT applied.
- build: `demowide` applied, `main` `display:grid`, grid-template-columns `476.094px 499.906px` (two-pane).
- say: `demowide` applied, `main` `display:grid`, two-pane `476.094px 499.906px`.
  → Confirms the two-pane layout renders on wide viewports WITHOUT demo mode, and setup/options/read
    do NOT get the grid.

Narrow, phone (innerWidth 526px, below the 900/1000 breakpoints):
- start: `main` max-width `560px`, `display:block`, `.opts` single column (`483.938px`), no grid.
- build: even with `demowide` on `#app`, `main` is `display:block` with `grid-template-columns:none` —
  the grid correctly does NOT render below 1000px. Phone-first column unchanged.

Demo mode (query `?demo`, innerWidth 1254px):
- start: `bodyDemo:true`, demo ribbon visible, `main` max-width `1120px`, `.opts` two columns `506px 506px`.
- build: `bodyDemo:true`, `demowide:true`, `main` `display:grid` two-pane `476.094px 499.906px`, ribbon visible.
  → Demo ribbon, amber styling, wide shell, and two-pane all intact; demo + wide viewport coexist with
    no conflicting layout.

Screenshots at 390px and 1280px confirmed visually: narrow = single-column phone layout with stacked
`.opts`; wide = ~1120px centered website shell with two-column `.opts` and website-sized (clamp) type,
not the oversized demo type.

Temporary verification artifacts (CDP driver scripts, screenshots) were removed after the run. No new
files were committed; this was not committed per the task instruction.
