'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

/**
 * Counts a number up when it first scrolls into view.
 *
 * Used on the homepage proof row. A number that ticks up is read as a number;
 * a number that is simply printed is read as decoration. It is one of the few
 * animations that carries meaning rather than polish, which is why it is here
 * and not on every heading.
 *
 * DESIGN RULES IT KEEPS
 * - The final value is in the DOM from the first server render, so a crawler,
 *   a no-JS visitor and a failed hydration all see the real figure. The
 *   animation replaces text that is already correct.
 * - It runs ONCE, on entry. A number that re-counts every time it scrolls past
 *   is a distraction.
 * - Reduced motion prints the value and never animates.
 * - Non-digits are preserved exactly: "1,000+" counts to 1,000 and keeps both
 *   the separator and the plus.
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const reducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const done = useRef(false);

  useEffect(() => {
    // `null` means "not measured yet"; `true` means the visitor asked for
    // stillness. Either way, leave the printed value alone.
    if (reducedMotion !== false || done.current) return;

    const digits = value.replace(/[^\d]/g, '');
    const target = Number(digits);
    if (!digits || !Number.isFinite(target) || target === 0) return;

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || done.current) return;
        done.current = true;
        observer.disconnect();

        const DURATION = 1100;
        const start = performance.now();

        const frame = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION);
          // Ease-out cubic: fast enough to feel responsive, settling rather
          // than stopping dead on the final figure.
          const eased = 1 - (1 - t) ** 3;
          const current = Math.round(target * eased);
          // Rebuild the original string with the running figure in place of
          // its digits, so "1,000+" keeps its comma and its plus throughout.
          setDisplay(value.replace(digits, current.toLocaleString('en-CA')));
          if (t < 1) requestAnimationFrame(frame);
          else setDisplay(value);
        };

        requestAnimationFrame(frame);
      },
      // Fires a little before the row is fully on screen, so the count is
      // already running by the time the eye lands on it.
      { threshold: 0.4, rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, value]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
