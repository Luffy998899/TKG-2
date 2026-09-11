import { divisions } from '@/config/divisions';

/**
 * The camera path, derived from the divisions config.
 *
 * One "stop" per keyframe: an intro, one per division, and an outro. The GSAP
 * timeline tweens between consecutive stops with `duration: 1` each, so
 * timeline time `t` maps to stop index `t` exactly - which is what lets the
 * DOM cards and the 3D beats be scheduled on the same clock.
 *
 * Layout rule: the overlay card ALTERNATES sides - division 01 bottom right,
 * 02 bottom left, and so on - and the slab always sits in the opposite half of
 * the frame from its card. The two are mirrored together by `slabSide()`, which
 * is what stops them ever fighting for the same pixels: swapping one without
 * the other puts a white card underneath a text card.
 *
 * The camera lane, the aim offset and the slab's turn are all multiplied by the
 * same side value, so a mirrored beat is a true mirror rather than a second set
 * of hand-tuned numbers.
 *
 * The whole layout is tier-aware. A portrait phone has roughly a third of the
 * horizontal field of view of a laptop, so the desktop lane spacing would put
 * every slab off-frame. 'lite' narrows the corridor and widens the lens rather
 * than showing an empty white screen.
 */

export type Tier = 'full' | 'lite';

export const SPACING = 9;

export type Vec3 = [number, number, number];

export interface CameraStop {
  position: Vec3;
  lookAt: Vec3;
}

interface Layout {
  /** The lane the slabs occupy. */
  slabX: number;
  /** Camera lane, before the per-division approach offset. */
  cameraX: number;
  /** How far in front of a slab the camera stops. */
  standoff: number;
  /** How far past the slab the camera aims, pushing it into its half of frame. */
  aimOffset: number;
  /** Vertical FOV in degrees. */
  fov: number;
  /** Where the intro stop sits. */
  intro: CameraStop;
}

const layouts: Record<Tier, Layout> = {
  full: {
    slabX: 2.85,
    cameraX: -0.9,
    standoff: 6.9,
    aimOffset: 1.9,
    fov: 42,
    /**
     * The intro framing has one job: keep slab 01 OUT of the corner the hero
     * copy occupies. The copy is bottom-left, so the camera aims well to the
     * LEFT of slab 01 (which sits at x = -slabX) and slightly DOWN — aiming
     * past an object on one side pushes it to the other, so the slab lands
     * upper-right with the whole lower-left quadrant clear for the wordmark.
     */
    intro: { position: [0, 1.2, 13.5], lookAt: [-5.3, -1.15, 0] },
  },
  lite: {
    slabX: 1.75,
    cameraX: -0.15,
    standoff: 6.7,
    aimOffset: 0.75,
    fov: 56,
    // Same rule as `full`, with less room to play with: a portrait screen has
    // roughly a quarter of the horizontal field of view, and the hero copy
    // runs the full width at the bottom. So the camera also sits further back
    // — the slab has to be small enough to finish above the copy, not just
    // beside it.
    intro: { position: [0, 1.05, 16.5], lookAt: [-3.9, -1.9, 0] },
  },
};

export const layoutFor = (tier: Tier): Layout => layouts[tier];

/** Small alternating camera offset - enough to vary the approach, not the side. */
/**
 * Which side of the frame each element takes, per division index.
 *
 * `cardSide` is the DOM overlay card - 01 right, 02 left, alternating.
 * `slabSide` is the 3D slab and is always the opposite: +1 puts the slab in the
 * right half of frame, -1 the left. They are mirrored together on purpose;
 * flipping one without the other puts a white card under a text card.
 */
export const cardSide = (index: number): 'left' | 'right' =>
  index % 2 === 0 ? 'right' : 'left';

export const slabSide = (index: number): number => (index % 2 === 0 ? -1 : 1);

/**
 * A small approach offset so consecutive beats are not identical framings.
 * Keyed on `% 3`, deliberately out of step with the `% 2` side flip - keying it
 * on parity too would make the offset a constant once multiplied by the side.
 */
export const approachOf = (index: number): number => [-0.45, 0.35, 0][index % 3];

/** Vertical rhythm across the seven beats. */
export const slabY = (index: number): number => [0.1, 0.55, -0.35][index % 3];

/** World position of a division's slab, mirrored by `slabSide`. */
export function slabPosition(index: number, tier: Tier): Vec3 {
  return [slabSide(index) * layouts[tier].slabX, slabY(index), -index * SPACING];
}

export function cameraStops(tier: Tier): CameraStop[] {
  const l = layouts[tier];

  return [
    l.intro,

    // One stop per division. The camera travels down the side opposite the
    // slab and aims PAST it, which is what pushes the slab into its half of the
    // frame and leaves the other half clear for the overlay card.
    ...divisions.map((_, i): CameraStop => {
      const side = slabSide(i);
      const [sx, sy, sz] = slabPosition(i, tier);
      return {
        position: [side * (l.cameraX + approachOf(i)), sy + 0.55, sz + l.standoff],
        lookAt: [sx - side * l.aimOffset, sy - 0.05, sz],
      };
    }),

    // Outro: rises and pulls away as the journey releases into the page.
    {
      position: [0, 2.6, -(divisions.length - 1) * SPACING - 6.5],
      lookAt: [0, -0.6, -(divisions.length - 1) * SPACING - 14],
    },
  ];
}

/**
 * Timeline duration in "stops" - i.e. the number of segments. Independent of
 * tier: intro + one per division + outro, minus one.
 */
export const TIMELINE_SEGMENTS = divisions.length + 1;

/**
 * Card scheduling, expressed as offsets from a division's own beat time.
 * Deliberately adjacent, not overlapping: card i finishes leaving at exactly
 * the moment card i+1 starts arriving, so two cards are never stacked on the
 * same corner of the screen.
 */
export const CARD_IN = { at: 0.45, duration: 0.35 } as const;
export const CARD_OUT = { at: 1.2, duration: 0.25 } as const;
