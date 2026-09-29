/**
 * Motion primitives shared by the DOM and the WebGL scene.
 *
 * House style follows Apple's fluid-interface guidance: critically damped by
 * default (no overshoot), a little bounce reserved for momentum-driven moments,
 * and everything frame-rate independent so a 120Hz display and a 60Hz display
 * settle at the same wall-clock speed.
 */

/** Frame-rate independent lerp. `smoothing` is the fraction remaining after 1s. */
export function damp(current: number, target: number, smoothing: number, dt: number): number {
  return target + (current - target) * Math.exp(-smoothing * dt);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Maps `value` from [inMin,inMax] to [0,1], clamped. Used for scroll beats. */
export function progressBetween(value: number, inMin: number, inMax: number): number {
  if (inMax === inMin) return 0;
  return clamp((value - inMin) / (inMax - inMin));
}

/** Smootherstep - zero first and second derivative at both ends. */
export function smootherstep(t: number): number {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Mirrored easing pair, so a reversible transition retraces its own path. */
export const ease = {
  outSoft: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inSoft: 'cubic-bezier(0.64, 0, 0.78, 0)',
} as const;

