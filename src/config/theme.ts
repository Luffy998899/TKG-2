/* =========================================================================
   THE DESIGN SYSTEM.

   Base palette lives here. Per-division accents live inside each entry in
   divisions.ts, so adding a division stays one config entry.

   Every pair in here is verified by `node scripts/check-contrast.mjs`.
   Change a hex, re-run that script.

   The site runs two grounds, not one:

     - a warm light ground for the content sections, where accents have to be
       dark enough to be legible ON it (`accent`, `accentInk`);
     - a deep cool `night` ground for the photographic hero and the closing CTA,
       where contrast runs the other way and accents have to be LIGHT enough to
       be legible on it (`accentBright`).

   That is why each division carries both a dark and a bright form of its
   colour. One value cannot pass AA on both grounds.
   ========================================================================= */

export interface DivisionTheme {
  /** The division's colour on light ground. UI accents, rules, active states. */
  accent: string;
  /** Darkened accent, safe as text on `paper` and on `accentSoft` (AA). */
  accentInk: string;
  /** Very light tint, safe as a background under `ink` and `accentInk`. */
  accentSoft: string;
  /** Text/icon colour to use on top of a solid `accent` fill (AA). */
  accentContrast: string;
  /** Light, vivid form. Only for use on `night` / `night-soft` (AA). */
  accentBright: string;
  /** Emissive colour in the 3D scene. Reads as light, not as paint. */
  glow: string;
}

/**
 * Warm neutral light ground, deep cool dark ground. The dark end is pulled
 * blue rather than warm because it sits behind dusk photography — a warm
 * charcoal under a blue-hour image reads as a colour cast.
 */
export const palette = {
  paper: '#F7F5F1',
  paperRaised: '#FFFFFF',
  paperSunk: '#EFECE5',

  ink: '#1C1A17',
  inkSoft: '#55504A',
  inkMute: '#6F6960',

  line: '#DFDAD1',
  lineStrong: '#C7C1B5',

  /** Dark ground: the hero stage, the CTA band, inverted surfaces. */
  night: '#0E1219',
  nightSoft: '#1A2029',
  /** Hairline on dark surfaces. */
  nightLine: '#2C3440',

  danger: '#A32F2A',
  ok: '#166F4E',
} as const;

/** Converts `#rrggbb` to the `r g b` triplet Tailwind's alpha syntax needs. */
export function rgbChannels(hex: string): string {
  const s = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)).join(' ');
}

/**
 * The CSS custom properties a themed subtree sets. Applied to a division page
 * wrapper and to a division card, so `bg-accent`, `text-accent-ink`,
 * `text-accent-bright`, `focus:ring-accent` etc. all resolve to that division's
 * colour with no per-page CSS.
 */
export function themeVars(theme: DivisionTheme): Record<string, string> {
  return {
    '--accent': rgbChannels(theme.accent),
    '--accent-ink': rgbChannels(theme.accentInk),
    '--accent-soft': rgbChannels(theme.accentSoft),
    '--accent-contrast': rgbChannels(theme.accentContrast),
    '--accent-bright': rgbChannels(theme.accentBright),
  };
}

/**
 * Site-wide default accent, used anywhere not scoped to a division (quote form,
 * contact form, header, 404). Deep blue — the one hue in the family that
 * belongs to no single division, and the one that matches the dusk backdrop.
 */
export const defaultTheme: DivisionTheme = {
  accent: '#1F5CA8',
  accentInk: '#1B4C8A',
  accentSoft: '#E6EDF7',
  accentContrast: '#FFFFFF',
  accentBright: '#7FB6F2',
  glow: '#5C8FC4',
};
