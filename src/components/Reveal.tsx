'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Section entrance, on the same GSAP ticker as the 3D journey and Lenis - so
 * DOM reveals never drift a frame behind the scene.
 *
 * Not scrubbed: a one-shot spring-ish reveal reads better than tying copy to
 * the scrollbar. `once: true` means it never replays and never re-measures.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  stagger = 0.06,
  className,
}: {
  children: React.ReactNode;
  as?: 'div' | 'section' | 'ul' | 'ol';
  delay?: number;
  stagger?: number;
  className?: string;
}) {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const targets = el.querySelectorAll<HTMLElement>('[data-reveal]');
      const items = targets.length ? Array.from(targets) : [el];

      gsap.fromTo(
        items,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          delay,
          stagger,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        },
      );
    }, el);

    return () => ctx.revert();
  }, [delay, stagger]);

  return (
    <Tag ref={root as never} className={className}>
      {children}
    </Tag>
  );
}
