# 001 — Fix press/hide transitions that target the wrong CSS property

- **Status**: DONE (applied 2026-09-05)
- **Commit**: (not a git repository — stamp: 2026-09-05, post-admin build)
- **Severity**: HIGH
- **Category**: 2 Easing & duration / 5 Performance (transition mis-targeting)
- **Estimated scope**: 4 files, ~10 lines

## Problem

Several press and hide interactions declare a transition on one property but
change a *different* one, so the motion snaps instantly with no easing at all.
This is the single most-felt defect on the site: every button press, the hero
card press, the floating WhatsApp button press, and the floating cluster's
hide-on-focus all jump.

The cause is the CSS `scale`/`translate` individual-transform properties versus
`transform`. Tailwind v3's `scale-*` and `translate-*` utilities set
`transform`, not `scale`/`translate`; a transition listing `scale` or
`translate` therefore never fires for them. The reverse also happens: `.btn`
transitions `transform` but its active state sets `scale`.

```css
/* src/app/globals.css:168–178 — current */
.btn {
  @apply inline-flex select-none items-center justify-center gap-2 rounded-full
         font-sans text-caption font-semibold leading-none
         transition-[transform,background-color,color,border-color,box-shadow]
         duration-150 ease-out-soft;
  padding: 0.8125rem 1.375rem;
  min-height: 44px; /* touch target */
}
.btn:active {
  scale: 0.96;           /* `scale` is not in the transition list → snaps */
}
```

```css
/* src/app/globals.css:428–430 — current (reduced-motion block) */
.btn:active {
  transform: none;       /* targets `transform`, but the active rule sets `scale` → no effect */
}
```

```tsx
{/* src/components/journey/Journey.tsx:~148 — current */}
<Link
  href={divisionPath(division.slug)}
  className="material-night group block rounded-panel p-5 shadow-float transition-[scale] duration-150 ease-out-soft active:scale-[0.98] md:p-6"
>
```
`active:scale-[0.98]` sets `transform`; `transition-[scale]` never fires.

```tsx
{/* src/components/FloatingContact.tsx:~46 — current (the wrapper) */}
'transition-[opacity,translate] duration-300 ease-out-soft',
hidden ? 'pointer-events-none translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
```
`translate-y-4` sets `transform`; `translate` is not what changes → only opacity fades, the 16px movement snaps.

```tsx
{/* src/components/FloatingContact.tsx:~58 and ~76 — current (both round buttons) */}
className="... transition-[scale,background-color] duration-150 ease-out-soft ... active:scale-95 ..."
className="... transition-[scale] duration-150 ease-out-soft active:scale-95"
```
Same mismatch.

`src/components/StickyCTA.tsx` is already correct (`transition-[transform,background-color]` with `active:scale-[0.97]`) and is the exemplar.

## Target

Every press uses the same curve and budget: **transform, 150ms, `ease-out-soft`**
(`cubic-bezier(0.22, 1, 0.36, 1)`, the repo's existing token; within the
100–160ms press budget). Release retraces the same curve. The floating cluster
hide uses **transform + opacity, 300ms**, same curve.

```css
/* src/app/globals.css — target */
.btn {
  @apply inline-flex select-none items-center justify-center gap-2 rounded-full
         font-sans text-caption font-semibold leading-none
         transition-[transform,background-color,color,border-color,box-shadow]
         duration-150 ease-out-soft;
  padding: 0.8125rem 1.375rem;
  min-height: 44px; /* touch target */
}
.btn:active {
  transform: scale(0.96);
}
```

```css
/* src/app/globals.css reduced-motion block — target (unchanged text, now effective) */
.btn:active {
  transform: none;
}
```

```tsx
{/* Journey.tsx — target */}
className="material-night group block rounded-panel p-5 shadow-float transition-transform duration-150 ease-out-soft active:scale-[0.98] md:p-6"
```

```tsx
{/* FloatingContact.tsx wrapper — target */}
'transition-[opacity,transform] duration-300 ease-out-soft',
hidden ? 'pointer-events-none translate-y-4 opacity-0' : 'translate-y-0 opacity-100',

{/* FloatingContact.tsx both buttons — target */}
className="... transition-[transform,background-color] duration-150 ease-out-soft ... active:scale-95 ..."
className="... transition-transform duration-150 ease-out-soft active:scale-95"
```

## Repo conventions to follow

- Easing token: Tailwind `ease-out-soft` = `cubic-bezier(0.22, 1, 0.36, 1)` (`tailwind.config.ts` → `transitionTimingFunction['out-soft']`). Do not hand-type a new curve.
- Press scale is 0.96–0.98 site-wide; keep each element's existing value.
- Exemplar that already does this correctly: `src/components/StickyCTA.tsx` — `transition-[transform,background-color] duration-150 ease-out-soft active:scale-[0.97]`.

## Steps

1. `src/app/globals.css`: in `.btn:active`, replace `scale: 0.96;` with `transform: scale(0.96);`. Leave the `.btn` transition list as is (it already contains `transform`). The reduced-motion override `.btn:active { transform: none; }` now works without change.
2. `src/components/journey/Journey.tsx`: on the division card `<Link>`, replace `transition-[scale]` with `transition-transform`.
3. `src/components/FloatingContact.tsx`: on the wrapper `<div>`, replace `'transition-[opacity,translate] duration-300 ease-out-soft'` with `'transition-[opacity,transform] duration-300 ease-out-soft'`.
4. `src/components/FloatingContact.tsx`: on the call `<a>`, replace `transition-[scale,background-color]` with `transition-[transform,background-color]`; on the WhatsApp `<a>`, replace `transition-[scale]` with `transition-transform`.
5. Grep to confirm nothing else pairs `transition-[scale` / `transition-[…translate…]` with a Tailwind `scale-*`/`translate-*` utility: `grep -rn "transition-\[scale\|transition-\[.*translate" src`. The only remaining `transition-property: scale` should be `.frame-img` in globals.css, which correctly pairs with the `scale:` property — leave it.

## Boundaries

- Do NOT touch `.frame-img` / `.group:hover .frame-img` (they use the `scale` property consistently and are correct).
- Do NOT change durations or scale amounts — only the transitioned property names.
- Do NOT touch `StickyCTA.tsx` (already correct).
- Do NOT add dependencies. If a line does not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` → no output; `npx next lint` → "No ESLint warnings or errors"; `npx next build` → succeeds.
- **Feel check**: open http://localhost:3000, DevTools → Animations panel at 10% speed. Press-and-hold "Get a quote" in the header: the button eases down to 96% over ~150ms and eases back on release — no snap either way. On a phone-width viewport, tap-and-hold the hero division card and the green WhatsApp button: same. Focus a form field: the floating cluster fades AND slides down together over 300ms; blur it: it returns the same way.
- Toggle `prefers-reduced-motion: reduce` (Rendering panel): pressing a `.btn` no longer scales (the existing override now applies).
- **Done when**: all four sites ease on press and release with no visible snap, and lint/build are clean.
