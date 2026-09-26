# 003 — Mobile menu sheet: slide in from the header instead of appearing

- **Status**: DONE (applied 2026-09-05)
- **Commit**: (not a git repository — stamp: 2026-09-05, post-admin build)
- **Severity**: HIGH
- **Category**: 8 Missed opportunities / 3 Physicality & origin
- **Estimated scope**: 2 files (`Header.tsx`, `globals.css`), ~20 lines

## Problem

On phones (the primary audience) the menu is a full-height sheet under the
header. It toggles with the `hidden` attribute, so the whole viewport changes
in one frame — the most jarring state change on the site, on the control
every mobile visitor uses to get anywhere. Nothing explains where the sheet
came from.

```tsx
{/* src/components/Header.tsx:~292–297 — current */}
<div
  id="mobile-menu"
  hidden={!menuOpen}
  className="material-strong h-[calc(100dvh-var(--header-h))] overflow-y-auto border-t border-line/70 lg:hidden"
  data-lenis-prevent
>
```

The hamburger button itself swaps its icon instantly between `MenuIcon` and
`CloseIcon` — acceptable (icon swap, high frequency); do not animate it.

## Target

The sheet is always mounted and slides **down from the header edge** —
where the trigger is — using a transition on `transform` + `opacity`:
`translateY(-8px)` → `0`, `opacity 0 → 1`, **220ms**, iOS-like drawer curve
`cubic-bezier(0.32, 0.72, 0, 1)`. Closing is faster, **160ms**, same curve.
`visibility` is delayed on close so the closed sheet is untabbable and out of
the accessibility tree. Interruptible: tapping the toggle twice fast reverses
from the current position.

```css
/* src/app/globals.css — target, add to :root */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

/* src/app/globals.css — target, add inside @layer components */
/** The mobile menu sheet. Slides from the header edge; interruptible. */
.menu-sheet {
  transform-origin: top center;
  opacity: 0;
  transform: translateY(-8px);
  visibility: hidden;
  transition:
    opacity 160ms var(--ease-drawer),
    transform 160ms var(--ease-drawer),
    visibility 0s linear 160ms;
}
.menu-sheet[data-open='true'] {
  opacity: 1;
  transform: translateY(0);
  visibility: visible;
  transition:
    opacity 220ms var(--ease-drawer),
    transform 220ms var(--ease-drawer),
    visibility 0s linear 0s;
}
```

```tsx
{/* src/components/Header.tsx — target */}
<div
  id="mobile-menu"
  data-open={menuOpen}
  aria-hidden={!menuOpen}
  className="menu-sheet material-strong h-[calc(100dvh-var(--header-h))] overflow-y-auto border-t border-line/70 lg:hidden"
  data-lenis-prevent
>
```

Note the sheet is `lg:hidden` (display:none at desktop) — that stays; the
transition only ever runs below `lg`.

## Repo conventions to follow

- Curve tokens in `:root` of `src/app/globals.css`, next to `--ease-ui-out` if plan 002 has been applied (otherwise next to `--header-h`).
- Component classes in `@layer components`; exemplar of the same pattern: `.menu-panel` from plan 002, or `.material-night` if 002 is not applied yet.
- The Lenis stop/start on open (`window.__lenis?.stop()` in the `menuOpen` effect) is unrelated to motion — leave it.

## Steps

1. `src/app/globals.css`: add `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);` to `:root`.
2. `src/app/globals.css`: add the `.menu-sheet` rules above inside `@layer components`.
3. `src/components/Header.tsx`: on `#mobile-menu`, replace `hidden={!menuOpen}` with `data-open={menuOpen} aria-hidden={!menuOpen}`, and prepend `menu-sheet` to its className.
4. Reduced motion, in the existing `@media (prefers-reduced-motion: reduce)` block of `globals.css`, add `.menu-sheet, .menu-sheet[data-open='true'] { transform: none; }` — keep the opacity fade.
5. Because the sheet is now always in the DOM, confirm the Escape-to-close and route-change-to-close effects in `Header.tsx` still set `menuOpen=false` (they do; no change expected).

## Boundaries

- Do NOT animate the hamburger/close icon swap.
- Do NOT change the sheet's contents, height, or scroll behaviour (`overflow-y-auto`, `data-lenis-prevent`).
- Do NOT touch the desktop dropdown (plan 002).
- Do NOT add dependencies. If the excerpt does not match, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit`; `npx next lint`; `npx next build` — all clean.
- **Feel check** (375px viewport, real phone if possible): tap the hamburger — the sheet fades in while easing down 8px from the header over ~220ms; it should feel like it slid out from under the header bar, not popped. Tap close: it lifts back in ~160ms. Tap the toggle twice quickly: the second tap reverses mid-motion, no flash. With the sheet closed, Tab through the header: nothing inside the sheet receives focus. Scroll inside the open sheet: still contained (Lenis stopped).
- Rendering panel → `prefers-reduced-motion: reduce`: the sheet fades only, no vertical movement.
- **Done when**: the sheet has a visible, reversible entrance and exit, is untabbable when closed, and lint/build pass.
