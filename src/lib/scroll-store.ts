/**
 * The bridge between GSAP ScrollTrigger and the R3F render loop.
 *
 * Deliberately NOT React state. ScrollTrigger writes `journey.progress` on every
 * scrub tick; `useFrame` reads it on every frame. Routing that through
 * useState would re-render the tree 60+ times a second for no benefit.
 *
 * The one thing the DOM genuinely needs to re-render on - which division beat is
 * active - is published through a minimal subscribe/snapshot store so
 * `useSyncExternalStore` can drive it without tearing.
 */

export interface JourneyState {
  /** 0 -> 1 across the whole pinned 3D journey. Written by ScrollTrigger. */
  progress: number;
  /** Scroll velocity in px/s, from Lenis. Used for motion-blur-style stretch. */
  velocity: number;
  /** Index of the division beat currently in focus. */
  beat: number;
  /** True once the WebGL canvas has actually mounted. */
  webglReady: boolean;
  /** True when the user has asked for reduced motion. */
  reducedMotion: boolean;
}

export const journey: JourneyState = {
  progress: 0,
  velocity: 0,
  beat: 0,
  webglReady: false,
  reducedMotion: false,
};

/* ----------------------------- beat subscription ----------------------------- */

type Listener = () => void;
const listeners = new Set<Listener>();

let beatSnapshot = 0;

export function setBeat(next: number): void {
  if (next === beatSnapshot) return;
  beatSnapshot = next;
  journey.beat = next;
  listeners.forEach((l) => l());
}

export function subscribeBeat(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBeatSnapshot(): number {
  return beatSnapshot;
}

/** Server snapshot - the first beat is always the one rendered on the server. */
export function getBeatServerSnapshot(): number {
  return 0;
}

