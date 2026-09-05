# 004 — FAQ accordion: reveal the answer instead of teleporting it

- **Status**: DONE (applied 2026-09-05)
- **Commit**: (not a git repository — stamp: 2026-09-05, post-admin build)
- **Severity**: MEDIUM
- **Category**: 8 Missed opportunities / 4 Interruptibility
- **Estimated scope**: 2 files (`FaqAccordion.tsx`, `globals.css`), ~25 lines

## Problem

The accordion is native `<details>`. Only the plus icon animates (rotates
45° in 200ms); the answer itself appears in one frame and shoves everything
below it down. On the security page and all five template division pages
this is the one interaction that visibly "jumps".

```tsx
{/* src/components/security/FaqAccordion.tsx:~20–52 — current */}
<details key={faq.question} name={`faq-${uid}`} className="group">
  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 md:py-6" id={`${uid}-${i}`}>
    …
    <span aria-hidden className="… transition-[transform,background-color,border-color] duration-200 ease-out-soft group-open:rotate-45 …">
  </summary>
  <div className="pb-6 pr-12">
    <p className="max-w-prose text-body text-ink-soft">{faq.answer}</p>
  </div>
</details>
```

Keeping `<details>` is right (keyboard, screen readers, no JS). The fix is
progressive enhancement in CSS only.

## Target

Two layers, both CSS:

1. **Everywhere**: the answer block fades and rises in — `opacity 0 → 1`,
   `translateY(-4px) → 0`, **200ms**, `cubic-bezier(0.23, 1, 0.32, 1)` — via
   `@starting-style`, so even browsers that cannot animate the height get a
   soft entrance rather than a pop.
2. **Where supported (Chromium 131+)**: the height itself animates using
   `interpolate-size: allow-keywords` and a transition on
   `::details-content`, **240ms**, same curve. Other browsers ignore these
   declarations and fall back to layer 1.

```css
/* src/app/globals.css — target, inside @layer components */

/**
 * FAQ accordion on native <details>. Progressive: every browser gets the
 * answer's fade-and-rise; Chromium additionally animates the height via
 * ::details-content. No JavaScript.
 */
.faq-item {
  interpolate-size: allow-keywords;
}
.faq-item::details-content {
  block-size: 0;
  overflow: clip;
  transition:
    block-size 240ms var(--ease-ui-out),
    content-visibility 240ms allow-discrete;
}
.faq-item[open]::details-content {
  block-size: auto;
}
.faq-body {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 200ms var(--ease-ui-out),
    transform 200ms var(--ease-ui-out);
}
@starting-style {
  .faq-item[open] .faq-body {
    opacity: 0;
    transform: translateY(-4px);
  }
}
```

`--ease-ui-out` is `cubic-bezier(0.23, 1, 0.32, 1)`; if plan 002 has not been
applied yet, add it to `:root` as part of this plan.

```tsx
{/* FaqAccordion.tsx — target */}
<details key={faq.question} name={`faq-${uid}`} className="faq-item group">
  …
  <div className="faq-body pb-6 pr-12">
```

## Repo conventions to follow

- Component classes in `@layer components` of `src/app/globals.css`.
- Curve token `--ease-ui-out` in `:root` (see plan 002).
- The icon's existing `transition-[transform,…] duration-200 ease-out-soft` is fine — leave it; the two motions (icon 200ms, body 200ms) will now finish together.

## Steps

1. `src/app/globals.css`: ensure `--ease-ui-out: cubic-bezier(0.23, 1, 0.32, 1);` exists in `:root`; add it if not.
2. `src/app/globals.css`: add the `.faq-item` / `.faq-body` / `@starting-style` rules above inside `@layer components`.
3. `src/components/security/FaqAccordion.tsx`: add `faq-item` to the `<details>` className (keep `group`), and `faq-body` to the answer `<div>` className.
4. Reduced motion, in the existing `@media (prefers-reduced-motion: reduce)` block: add `.faq-item::details-content { transition: none; } .faq-body { transform: none; }` — the opacity fade stays.
5. Update the component's doc comment (top of `FaqAccordion.tsx`) to say the reveal is CSS-only and progressive; remove the sentence claiming it is "marked client only so the marker animation runs under motion-safe" if present, since that is no longer why it is a client component (it uses `useId`, which works in either; the `'use client'` directive may simply stay).

## Boundaries

- Do NOT replace `<details>` with a JS accordion.
- Do NOT change the `name` attribute (it is what makes the group exclusive).
- Do NOT add dependencies. If the excerpt does not match, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit`; `npx next lint`; `npx next build` — all clean.
- **Feel check** (http://localhost:3000/services/security-smart-home, FAQ section): open a question — in Chrome the row grows smoothly over ~240ms while the answer text fades in and settles up 4px; in Safari/Firefox the row grows instantly but the text still fades in (acceptable fallback). Open a second question: the first closes as the second opens; no double-height flash. Click the same question rapidly 3×: no stuck half-open state (the height transition retargets).
- Rendering panel → `prefers-reduced-motion: reduce`: the answer appears with a fade only, no height animation.
- **Done when**: no FAQ answer appears in a single frame in Chromium, the fallback still fades, and lint/build pass.
