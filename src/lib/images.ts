import manifest from '../../public/divisions/manifest.json';

/**
 * Image metadata generated alongside the artwork by
 * `node scripts/generate-division-images.mjs`.
 *
 * Importing the manifest rather than hardcoding dimensions means `next/image`
 * always gets the true intrinsic size and a real LQIP blur, and both stay
 * correct when the artwork is regenerated or replaced.
 */
export interface DivisionImageMeta {
  /** Full-size artwork, served through next/image. */
  src: string;
  /**
   * A 512x320 copy for the WebGL slab. three.js fetches the raw file - it
   * cannot use next/image's optimised variants - so the scene gets its own
   * small texture instead of the full-size original.
   *
   * Absent on `hero-backdrop`, which is a DOM image only and never a texture.
   */
  texture?: string;
  /** Unsplash photo id, for looking the photographer up. See the fetch script. */
  unsplashId?: string;
  credit?: string;
  width: number;
  height: number;
  blurDataURL: string;
}

const images = manifest as Record<string, DivisionImageMeta>;

export function imageMeta(slug: string): DivisionImageMeta | undefined {
  return images[slug];
}

/**
 * Responsive `sizes` presets. Getting these right is the difference between
 * shipping a 1280px image to a 375px phone and shipping a 375px one.
 */
export const imageSizes = {
  /** Full-width single column on mobile, half the shell at md+, third at xl. */
  gridCard: '(min-width: 1280px) 30vw, (min-width: 768px) 46vw, 100vw',
  /** The division page hero: roughly half the shell on desktop. */
  pageHero: '(min-width: 1024px) 46vw, 100vw',
  /** Small square thumbnail inside the journey overlay card. */
  thumb: '96px',
  /** The reduced-motion / lite static strip. */
  strip: '(min-width: 768px) 33vw, 80vw',
} as const;
