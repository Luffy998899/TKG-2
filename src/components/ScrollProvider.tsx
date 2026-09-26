'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { journey } from '@/lib/scroll-store';

/* =========================================================================
   THE SCROLL ENGINE.

   Lenis, GSAP and the R3F render loop must share ONE clock, or the 3D scene
   drifts a frame or two behind the DOM and the whole thing reads as cheap.
   The wiring, in order:

     1. Lenis owns scroll position (it hijacks the wheel and lerps).
     2. Lenis's `scroll` event calls ScrollTrigger.update() so every trigger
        reads the smoothed position, not the raw native one.
     3. GSAP's ticker drives Lenis's raf(time) - so GSAP is the single clock.
        (Lenis wants milliseconds, gsap.ticker hands out seconds.)
     4. lagSmoothing(0) stops GSAP from silently skipping ahead after a long
        frame, which would desync the camera from the scrollbar.
     5. R3F's own loop reads `journey.progress` in useFrame. It runs on rAF,
        the same display clock GSAP's ticker uses.

   This provider is mounted once in the root layout and lives for the whole
   session; route changes only refresh the triggers.
   ========================================================================= */

gsap.registerPlugin(ScrollTrigger);

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);

    // ---- Reduced motion: no smoothing, no scrub. Native scroll, static scene.
    if (media.matches) {
      journey.reducedMotion = true;
      ScrollTrigger.normalizeScroll(false);
      return () => {
        ScrollTrigger.getAll().forEach((t) => t.kill());
      };
    }

    journey.reducedMotion = false;

    const lenis = new Lenis({
      // A single exponential smoothing constant. Higher = snappier, closer to
      // native. 0.09 tracks the wheel closely without feeling floaty.
      lerp: 0.09,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      // Touch devices keep native scrolling: hijacking it costs more in jank
      // and accessibility than the smoothing is worth.
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false,
    });

    // (2) every smoothed scroll frame updates every trigger.
    const onScroll = () => {
      journey.velocity = lenis.velocity;
      ScrollTrigger.update();
    };
    lenis.on('scroll', onScroll);

    // (3) one clock: GSAP's ticker drives Lenis.
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);

    // (4) never let GSAP "catch up" by jumping - it would break scrub sync.
    gsap.ticker.lagSmoothing(0);

    // Expose for the debug harness and for components that need to stop scroll
    // (open sheet, focus trap) without reaching for a second Lenis instance.
    window.__lenis = lenis;

    // No scrollerProxy: Lenis in window mode still moves the real document
    // scroll position, so ScrollTrigger's default scroller is already correct -
    // and proxying it here would break `pin`. Lenis only needs to re-measure
    // when ScrollTrigger does.
    const onRefresh = () => lenis.resize();
    ScrollTrigger.addEventListener('refresh', onRefresh);
    ScrollTrigger.refresh();

    return () => {
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33); // restore the GSAP default
      lenis.off('scroll', onScroll);
      lenis.destroy();
      delete window.__lenis;
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  // A route change swaps the whole document; triggers must re-measure against
  // the new content, and scroll must start at the top.
  useEffect(() => {
    window.__lenis?.scrollTo(0, { immediate: true });
    journey.progress = 0;
    // Two frames: one for React to commit, one for layout/fonts to settle.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => ScrollTrigger.refresh()));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return <>{children}</>;
}

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}
