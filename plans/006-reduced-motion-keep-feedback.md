# 006 — Reduced motion: drop movement, keep colour and opacity feedback

- **Status**: DONE (applied 2026-09-05)
- **Commit**: (not a git repository — stamp: 2026-09-05, post-admin build)
- **Severity**: MEDIUM
- **Category**: 6 Accessibility
- **Estimated scope**: 1 file (`globals.css`), ~15 lines

## Problem

The reduced-motion block zeroes **every** transition on the page. That
removes the colour and opacity feedback that helps comprehension — hover
tints, focus rings settling, the form's status region fading in, the
floating cluster's fade — not just the movement. Reduced motion means fewer
and gentler animations, not none.

```css
/* src/app/globals.css:~419–433 — current */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .btn:active {
    transform: none;
  }
  .group:hover .frame-img {
    transform: none;
  }
```

The pinned-journey overrides further down in the same block are correct and
deliberate (they collapse the 3D scroll experience) — do not touch them.

## Target

Movement is removed per-component (transforms, translations, scale, the GSAP
reveals — which already skip themselves under reduced motion in
`Reveal.tsx:34`); short colour/opacity transitions are **restored** for the
interactive surfaces after the global kill.

```css
/* src/app/globals.css — target (replace the first two rules of the block) */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Keep the feedback that aids comprehension: colour, border, shadow and
     opacity may still ease. Only movement is removed. */
  .btn,
  .chip,
  .card,
  .field-control,
  .field-tile,
  .field-file::file-selector-button,
  [data-nav-link],
  .menu-panel,
  .menu-sheet,
  .faq-body {
    transition-duration: 150ms !important;
    transition-property: color, background-color, border-color, box-shadow, opacity !important;
  }

  .btn:active {
    transform: none;
  }
  .group:hover .frame-img {
    scale: 1;
  }
```

`.menu-panel`, `.menu-sheet` and `.faq-body` only exist once plans 002–004
are applied; listing a selector that matches nothing is harmless, so the
rule can be written in full regardless of order.

## Repo conventions to follow

- All reduced-motion handling lives in the single `@media (prefers-reduced-motion: reduce)` block at the bottom of `src/app/globals.css`; extend it, do not add a second block.
- The block already uses `!important` to beat Tailwind's later `md:` variants — follow that.

## Steps

1. `src/app/globals.css`: inside the reduced-motion block, after the universal `*` rule, insert the feedback-restoring rule above.
2. Same block: change `.group:hover .frame-img { transform: none; }` to `scale: 1;` (the hover rule sets the `scale` property; `transform: none` does not cancel it). Skip if plan 005 already made this change.
3. Leave `.btn:active { transform: none; }` — correct once plan 001 is applied.

## Boundaries

- Do NOT touch the `#journey-track` / `#journey-stage` / `[data-journey-*]` rules in the same block.
- Do NOT restore `transform`/`translate`/`scale` transitions for anything — movement stays off.
- If the excerpt does not match, STOP and report.

## Verification

- **Mechanical**: `npx next build` clean.
- **Feel check**: DevTools → Rendering → emulate `prefers-reduced-motion: reduce`. Hover a `.btn-ghost`: the background still tints over ~150ms. Hover a division card: no image zoom, no arrow movement, but the border/shadow lift still eases. Focus a form field: the floating contact cluster still fades out (no slide). Homepage: the 3D journey is still collapsed to the static strip (unchanged).
- **Done when**: under reduced motion no element moves, but colour/opacity feedback on buttons, chips, cards and fields still transitions.
