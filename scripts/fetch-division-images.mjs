/* =========================================================================
   Downloads the real photography used across the site into public/divisions/.

   Run:  node scripts/fetch-division-images.mjs

   SOURCE + LICENCE
   ----------------
   All photographs come from Unsplash and are used under the Unsplash Licence:
   free for commercial and non-commercial use, no permission needed, attribution
   appreciated but not required. https://unsplash.com/license

   Two things the licence does NOT cover, which the business must confirm before
   launch:
     1. It grants no model or property releases. The set below was chosen to
        avoid recognisable faces and identifiable branded property for exactly
        this reason, but a lawyer should sign off on commercial use.
     2. Photos can be withdrawn by their author. The files are downloaded and
        committed rather than hot-linked, so the site never depends on Unsplash
        being up - but re-running this script may fail for a withdrawn photo.

   To credit the photographers (optional under the licence), look each
   `unsplashId` up via the Unsplash API `/photos/:id` endpoint and put the name
   in `credit` below.

   SWAPPING IN YOUR OWN PHOTOGRAPHY
   -------------------------------
   Replace the files in public/divisions/ directly - `<slug>.jpg` at 1600x1000,
   `<slug>-tex.jpg` at 512x320 - then update the matching entry in
   manifest.json. Or point `unsplashId` at a different photo and re-run.
   ========================================================================= */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'divisions');

/** Full-size render used by next/image: hero, cards, OG. */
const FULL = { w: 1600, h: 1000, q: 78 };
/** The WebGL slab texture. three.js fetches the raw file, so it gets its own. */
const TEX = { w: 512, h: 320, q: 72 };
/** LQIP source. Inlined as a data URL, never written to disk. */
const BLUR = { w: 12, h: 8, q: 40 };

const url = (id, { w, h, q }) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&crop=entropy&fm=jpg&q=${q}`;

/**
 * One entry per division, plus the hero backdrop. `slug` must match
 * src/config/divisions.ts. `note` records why the photo was chosen, so a later
 * swap can aim at the same thing.
 */
const IMAGES = [
  {
    slug: 'automotive',
    unsplashId: 'photo-1585503418537-88331351ad99',
    credit: '[PHOTOGRAPHER]',
    note: 'A line of dark vehicles in low showroom light. Reads as inventory, no people, no plates.',
  },
  {
    slug: 'real-estate',
    unsplashId: 'photo-1627141234469-24711efb373c',
    credit: '[PHOTOGRAPHER]',
    note: 'Contemporary house at dusk with lit windows. Warm light against a dark facade.',
  },
  {
    slug: 'security-smart-home',
    unsplashId: 'photo-1728971568218-03a7f87c9e99',
    credit: '[PHOTOGRAPHER]',
    note: 'A sensor lit in blue and magenta. Abstract enough to avoid dating the hardware.',
  },
  {
    slug: 'moving-delivery',
    unsplashId: 'photo-1586781383963-8e66f88077ec',
    credit: '[PHOTOGRAPHER]',
    note: 'Stacked cartons on a pallet. Unambiguous subject, no people.',
  },
  {
    slug: 'cleaning-staffing',
    unsplashId: 'photo-1633505899118-4ca6bd143043',
    credit: '[PHOTOGRAPHER]',
    note: 'A bright, spotless interior. The result of the service rather than the act of it.',
  },
  {
    slug: 'telecommunications',
    unsplashId: 'photo-1606814540563-5c02d62fd409',
    credit: '[PHOTOGRAPHER]',
    note: 'Fibre strands on black. The one genuinely dark image in the set.',
  },
  {
    slug: 'business-services',
    unsplashId: 'photo-1487017159836-4e23ece2e4cf',
    credit: '[PHOTOGRAPHER]',
    note: 'An overhead desk still life. Abstract, no faces, no company marks.',
  },
  {
    /** Not a division: the full-bleed backdrop behind the homepage hero. */
    slug: 'hero-backdrop',
    unsplashId: 'photo-1659221483787-66b4e6c00c78',
    credit: '[PHOTOGRAPHER]',
    note: 'City skyline at dusk over water. Deep blue with a warm horizon - the tonal anchor for the whole dark hero.',
    /** Wider crop: it spans the viewport rather than a card. */
    full: { w: 2000, h: 1125, q: 74 },
    texture: false,
  },
];

async function grab(target) {
  const res = await fetch(target);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${target}`);
  return Buffer.from(await res.arrayBuffer());
}

mkdirSync(OUT, { recursive: true });

const manifest = {};

for (const image of IMAGES) {
  const fullSpec = image.full ?? FULL;

  const full = await grab(url(image.unsplashId, fullSpec));
  writeFileSync(join(OUT, `${image.slug}.jpg`), full);

  let texture;
  if (image.texture !== false) {
    texture = await grab(url(image.unsplashId, TEX));
    writeFileSync(join(OUT, `${image.slug}-tex.jpg`), texture);
  }

  const blur = await grab(url(image.unsplashId, BLUR));

  manifest[image.slug] = {
    src: `/divisions/${image.slug}.jpg`,
    ...(texture ? { texture: `/divisions/${image.slug}-tex.jpg` } : {}),
    width: fullSpec.w,
    height: fullSpec.h,
    blurDataURL: `data:image/jpeg;base64,${blur.toString('base64')}`,
    unsplashId: image.unsplashId,
    credit: image.credit,
  };

  const kb = (n) => `${Math.round(n / 1024)}kB`;
  console.log(
    `${image.slug.padEnd(22)} full ${kb(full.length).padStart(6)}` +
      (texture ? `  tex ${kb(texture.length).padStart(5)}` : ''),
  );
}

writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nWrote ${IMAGES.length} images + manifest.json to public/divisions/`);
