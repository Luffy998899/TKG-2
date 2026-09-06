'use client';

import { useEffect, useState } from 'react';
import { journey } from '@/lib/scroll-store';

/**
 * Returns `null` on the server and on the very first client render, then the
 * real preference. The tri-state matters: it lets a component avoid committing
 * to either variant until it actually knows, instead of flashing the wrong one.
 */
export function usePrefersReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      journey.reducedMotion = media.matches;
      setReduced(media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  return reduced;
}
