# 005 — Gate hover motion behind hover-capable input

- **Status**: DONE (applied 2026-09-05)
- **Commit**: (not a git repository — stamp: 2026-09-05, post-admin build)
- **Severity**: MEDIUM
- **Category**: 6 Accessibility (touch false-hover)
- **Estimated scope**: 2 files (`tailwind.config.ts`, `globals.css`), ~6 lines

## Problem

The site is viewed primarily on phones, and every hover effect is ungated.
Touch browsers apply `:hover` on tap and leave it "stuck" until the next
tap elsewhere, so on a phone a tapped card zooms its photo to 103% and its
arrow shunts right, and stays that way. On a link that navigates it is a
brief glitch; on the hero card and product cards it is visible for the
whole navigation delay.

```css
/* src/app/globals.css:~392–399 — current */
.frame-img {
  @apply h-full w-full object-cover;
  transition-property: scale;
  transition-duration: 600ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
.group:hover .frame-img {
  scale: 1.03;
}
```

Tailwind `hover:` / `group-hover:` variants (used on ~20 elements: arrow
nudges `group-hover:translate-x-1`, card border/shadow `.card-interactive:hover`,
button colour states) are likewise unconditional.

## Target

All hover-only motion runs only when the device actually hovers:
`@media (hover: hover) and (pointer: fine)`. Colour-only hover states are
harmless on touch and may stay, but gating everything via Tailwind's flag is
simpler and consistent.

```ts
// tailwind.config.ts — target: add at the top level of the config object
future: {
  hoverOnlyWhenSupported: true,
},
```
This makes every `hover:` / `group-hover:` variant compile inside
`@media (hover: hover) and (pointer: fine)`.

```css
/* src/app/globals.css — target */
@media (hover: hover) and (pointer: fine) {
  .group:hover .frame-img {
    scale: 1.03;
  }
}
```

The hand-written `.card-interactive:hover` (globals.css) and `.btn-*:hover`,
`.chip:hover`, `.field-control:hover`, `.field-tile:hover`, `.field-file:hover`
rules are colour/shadow only and may stay ungated.

## Repo conventions to follow

- Tailwind config: `tailwind.config.ts`, `Config` object — `future` sits beside `content` and `theme`.
- Media-query wrappers in `globals.css` follow the existing pattern at the bottom of the file (`@media (prefers-reduced-motion: reduce)` etc.).

## Steps

1. `tailwind.config.ts`: add `future: { hoverOnlyWhenSupported: true },` as a sibling of `content:`.
2. `src/app/globals.css`: wrap the `.group:hover .frame-img { scale: 1.03; }` rule in `@media (hover: hover) and (pointer: fine) { … }`.
3. The reduced-motion block already contains `.group:hover .frame-img { transform: none; }` — change it to `scale: 1;` so it actually cancels the `scale` property (the current `transform: none` does not).
4. Rebuild CSS (`npx next build` or the dev server) and inspect one `group-hover:` rule in DevTools to confirm it is now inside the `(hover: hover)` media query.

## Boundaries

- Do NOT remove any hover style — gate, don't delete.
- Do NOT touch the `:active` press states (they are the touch feedback and must stay ungated).
- If `future` already exists in the config, merge the key rather than duplicating the block.

## Verification

- **Mechanical**: `npx next build` clean. In DevTools, select a division card image: the `scale: 1.03` rule shows under `@media (hover: hover) and (pointer: fine)`.
- **Feel check**: DevTools device toolbar → a phone preset (touch emulation on). Tap a division card and hold: the photo does NOT zoom and the arrow does NOT move; the card's press state still shows. Switch back to desktop (mouse): hover a card — photo zooms over 600ms, arrow nudges. Real phone: tap a product card on /services/security-smart-home and navigate back — the card is not left in a hovered state.
- **Done when**: no hover-driven transform fires under touch emulation, desktop hover is unchanged, and the build is clean.
