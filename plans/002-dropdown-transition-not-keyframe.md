# 002 — Header dropdown: interruptible transition from its trigger, not a 550ms keyframe

- **Status**: DONE (applied 2026-09-05)
- **Commit**: (not a git repository — stamp: 2026-09-05, post-admin build)
- **Severity**: HIGH
- **Category**: 2 Easing & duration / 3 Physicality & origin / 4 Interruptibility
- **Estimated scope**: 2 files (`Header.tsx`, `globals.css`), ~25 lines

## Problem

The desktop "Divisions" dropdown is a hover-opened, hit-many-times-a-day
element. It enters with a **550ms keyframe** — more than double the 150–250ms
dropdown budget — and the keyframe restarts from zero every time the panel
mounts, so a hover that clips the trigger twice plays the full rise twice. It
also has no exit at all (`hidden` toggles it off instantly) and no scale from
its trigger; it only translates up 14px from wherever it lands.

```tsx
{/* src/components/Header.tsx:~200–208 — current */}
<div
  id="services-menu"
  hidden={!servicesOpen}
  className="absolute left-0 top-full w-[30rem] pt-2.5"
>
  <ul className="material-strong grid gap-0.5 rounded-panel border border-line/70 p-2 shadow-float motion-safe:animate-rise">
```

```ts
// tailwind.config.ts:100–109 — current keyframe used above
keyframes: {
  rise: {
    from: { opacity: '0', transform: 'translate3d(0, 14px, 0)' },
    to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
  },
},
animation: {
  rise: 'rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
},
```

## Target

The panel stays in the DOM, driven by a `data-open` attribute and a CSS
**transition** (interruptible: reopening mid-close retargets from the current
state). It scales from **top-left** — where the trigger is — from
`scale(0.97)` + `opacity: 0`, over **180ms** with the strong ease-out
`cubic-bezier(0.23, 1, 0.32, 1)`, and closes over **120ms** with the same
curve. `visibility` is transitioned with a delay on close so the closed panel
is out of the accessibility tree and unfocusable, matching what `hidden` gave.

```css
/* src/app/globals.css — target, add inside @layer components */

/** Strong UI ease-out for enter/exit motion (dropdowns, sheets). */
:root {
  --ease-ui-out: cubic-bezier(0.23, 1, 0.32, 1);
}

/**
 * Trigger-anchored panel. Transition, not keyframe: a hover that clips the
 * trigger twice must not replay the entrance from zero.
 */
.menu-panel {
  transform-origin: top left;
  opacity: 0;
  transform: translateY(6px) scale(0.97);
  visibility: hidden;
  transition:
    opacity 120ms var(--ease-ui-out),
    transform 120ms var(--ease-ui-out),
    visibility 0s linear 120ms;
}
.menu-panel[data-open='true'] {
  opacity: 1;
  transform: translateY(0) scale(1);
  visibility: visible;
  transition:
    opacity 180ms var(--ease-ui-out),
    transform 180ms var(--ease-ui-out),
    visibility 0s linear 0s;
}
```

```tsx
{/* src/components/Header.tsx — target */}
<div
  id="services-menu"
  data-open={servicesOpen}
  aria-hidden={!servicesOpen}
  className="menu-panel absolute left-0 top-full w-[30rem] pt-2.5"
>
  <ul className="material-strong grid gap-0.5 rounded-panel border border-line/70 p-2 shadow-float">
```

The `pt-2.5` bridge padding stays (it is what keeps hover alive between the
button and the panel — see the comment above it in the file).

## Repo conventions to follow

- Tokens live in `src/app/globals.css` under `:root` (see `--shell-x`, `--header-h`). Add `--ease-ui-out` there; do not hand-type the curve at the use site.
- Component classes live in `@layer components` in the same file (exemplar: `.material-night`, `.field-tile`).
- The existing `ease-out-soft` token (`cubic-bezier(0.22, 1, 0.36, 1)`) is for hover/colour; the new `--ease-ui-out` is for enter/exit. Keep them separate.

## Steps

1. `src/app/globals.css`: add `--ease-ui-out: cubic-bezier(0.23, 1, 0.32, 1);` to the `:root` block (after `--header-h`).
2. `src/app/globals.css`: add the `.menu-panel` / `.menu-panel[data-open='true']` rules above inside `@layer components`, next to `.material-night`.
3. `src/components/Header.tsx`: on `#services-menu`, replace `hidden={!servicesOpen}` with `data-open={servicesOpen} aria-hidden={!servicesOpen}` and prepend `menu-panel` to its className.
4. `src/components/Header.tsx`: remove `motion-safe:animate-rise` from the inner `<ul>`.
5. `tailwind.config.ts`: the `rise` keyframe/animation is now unused — grep `animate-rise` across `src`; if no other use, delete the `keyframes.rise` and `animation.rise` entries.
6. In the reduced-motion block of `globals.css` (`@media (prefers-reduced-motion: reduce)`), add: `.menu-panel, .menu-panel[data-open='true'] { transform: none; }` — the opacity fade stays (feedback), movement goes.

## Boundaries

- Do NOT change the hover/click open logic, the 120ms hover grace timer, or the outside-click/Escape dismissal in `Header.tsx`.
- Do NOT touch the mobile sheet (`#mobile-menu`) — that is plan 003.
- Do NOT add dependencies. If the excerpts do not match, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit`; `npx next lint`; `npx next build` — all clean. `grep -rn "animate-rise" src` → no results.
- **Feel check** (viewport ≥ 1024px, http://localhost:3000): hover "Divisions" — the panel grows from its top-left corner (not from centre, not just rising) in ~180ms. Move the mouse off and back on quickly, before it has closed: it must **reverse from where it was**, never blink to invisible and replay. In DevTools → Animations at 10%: entrance is one transition, no restart. Keyboard: Tab to "Divisions", press Enter, Tab into the list — items are reachable when open; when closed, Tab skips the panel entirely (visibility hidden).
- Rendering panel → `prefers-reduced-motion: reduce`: the panel still fades in/out but no longer scales or moves.
- **Done when**: the dropdown opens in ≤200ms from its trigger, reverses cleanly when interrupted, is unfocusable while closed, and the `rise` keyframe is gone.
