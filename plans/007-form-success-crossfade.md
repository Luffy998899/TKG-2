# 007 — Form success: ease into the "sent" card instead of swapping it

- **Status**: DONE (applied 2026-09-05)
- **Commit**: (not a git repository — stamp: 2026-09-05, post-admin build)
- **Severity**: LOW (missed opportunity — a rare, high-emotion moment)
- **Category**: 8 Missed opportunities
- **Estimated scope**: 2 files (`InquiryForm.tsx`, `globals.css`), ~12 lines

## Problem

Submitting any form is the site's one success moment, and it is rendered
with zero delight budget: the whole form is unmounted and a much shorter
"Thank you — that's sent." card is mounted in its place in one frame. The
page height collapses instantly and the eye loses its place.

```tsx
{/* src/components/form/InquiryForm.tsx:~125–150 — current */}
if (status === 'success') {
  return (
    <div
      ref={statusRef}
      tabIndex={-1}
      role="status"
      className={`card p-8 md:p-10 ${className ?? ''}`}
    >
```

## Target

The success card **enters** with a soft rise-and-fade — `opacity 0 → 1`,
`translateY(8px) → 0`, **280ms**, `cubic-bezier(0.23, 1, 0.32, 1)` — using
`@starting-style` so no JS timing is involved. The check-mark badge inside it
scales in slightly after: `scale(0.9) → 1`, `opacity 0 → 1`, 280ms, same
curve, **80ms delay**. Modest, one-shot, no bounce (the site's motion is
critically damped by house style — see `src/lib/motion.ts` header comment).

```css
/* src/app/globals.css — target, inside @layer components */
/** One-shot entrance for the form's success card. */
.form-success {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 280ms var(--ease-ui-out),
    transform 280ms var(--ease-ui-out);
}
.form-success-badge {
  opacity: 1;
  transform: scale(1);
  transition:
    opacity 280ms var(--ease-ui-out) 80ms,
    transform 280ms var(--ease-ui-out) 80ms;
}
@starting-style {
  .form-success {
    opacity: 0;
    transform: translateY(8px);
  }
  .form-success-badge {
    opacity: 0;
    transform: scale(0.9);
  }
}
```

```tsx
{/* InquiryForm.tsx — target */}
<div
  ref={statusRef}
  tabIndex={-1}
  role="status"
  className={`form-success card p-8 md:p-10 ${className ?? ''}`}
>
  <span className="form-success-badge inline-flex h-11 w-11 items-center justify-center rounded-full bg-ok/10 text-ok">
```

## Repo conventions to follow

- `--ease-ui-out` in `:root` (plan 002); add it if absent.
- Component classes in `@layer components`.
- Never `scale(0)`: the badge starts at 0.9.

## Steps

1. `src/app/globals.css`: add the `.form-success` / `.form-success-badge` / `@starting-style` rules inside `@layer components`.
2. `src/components/form/InquiryForm.tsx`: add `form-success` to the success `<div>` className and `form-success-badge` to the check-mark `<span>`.
3. Reduced motion: in the `@media (prefers-reduced-motion: reduce)` block add `.form-success, .form-success-badge { transform: none; }` — fade only.

## Boundaries

- Do NOT animate the form's *submit* or *error* states — the submitting spinner and error box are feedback and must appear instantly.
- Do NOT delay focus: `statusRef.current?.focus()` must still run in the same `requestAnimationFrame` it does today.
- Do NOT add dependencies. If the excerpt does not match, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit`; `npx next lint`; `npx next build` — clean.
- **Feel check**: fill and submit the contact form. The success card rises 8px and fades in over ~280ms; the green check settles in just after. Focus lands on the card (screen reader announces it) without waiting for the animation. Click "Send another": the form returns instantly (no exit animation is intended).
- Rendering panel → `prefers-reduced-motion: reduce`: the card fades in only.
- **Done when**: the swap from form to success card is no longer a single-frame cut, and focus timing is unchanged.
