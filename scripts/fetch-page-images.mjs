/* =========================================================================
   Downloads the photography for the pages that are not one of the seven
   division cards: the Security & Smart Home microsite, the Automotive
   sourcing page and Careers.

   Run:  node scripts/fetch-page-images.mjs

   This is the sibling of scripts/fetch-division-images.mjs and follows the
   same rules. Read that file's header first - the licence position is
   identical and is not repeated here in full.

   SOURCE + LICENCE (summary)
   --------------------------
   Unsplash Licence: free for commercial use, no permission needed,
   attribution appreciated but not required. https://unsplash.com/license
   It grants NO model or property release, so the set below deliberately
   avoids recognisable faces and identifiable branded property. A lawyer
   should still sign off before launch.

   IMPORTANT - THESE ARE NOT TKG'S OWN PHOTOGRAPHS
   -----------------------------------------------
   The three `install-*` frames stand in for real installation photography on
   the security page. They show representative equipment, NOT work carried out
   by TKG Ventures, and the page labels them as such. Replace them with real
   job photos before launch and drop that label.

   SWAPPING IN YOUR OWN PHOTOGRAPHY
   -------------------------------
   Replace public/media/<key>.jpg (1600x1000, or the wider size noted below)
   and update the matching entry in public/media/manifest.json. Nothing in the
   components hardcodes a filename.
   ========================================================================= */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'media');

/** Card / product artwork. */
const FULL = { w: 1600, h: 1000, q: 78 };
/** Full-bleed page heroes. */
const WIDE = { w: 2000, h: 1125, q: 74 };
/** LQIP source. Inlined as a data URL, never written to disk. */
const BLUR = { w: 12, h: 8, q: 40 };

const url = (id, { w, h, q }) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&crop=entropy&fm=jpg&q=${q}`;

const IMAGES = [
  /* ------------------------------------------------- security: sections */
  {
    key: 'security-hero',
    id: 'photo-1785746730462-74049651fa26',
    full: WIDE,
    note: 'Modern house at dusk with lit windows. Deep blue - the same tonal family as the homepage backdrop, so the microsite reads as part of the site.',
  },
  {
    key: 'security-protect',
    id: 'photo-1748063578185-3d68121b11ff',
    note: 'Contemporary house exterior glowing at night. The "Protect" pillar: the perimeter, lit.',
  },
  {
    key: 'security-watch',
    id: 'photo-1769847933914-a29c8e17aae9',
    note: 'Cameras mounted against siding. The "Watch" pillar. No people, no readable brand.',
  },
  {
    key: 'security-automate',
    id: 'photo-1600607687939-ce8a6c25118c',
    note: 'Calm modern living room. The "Automate" pillar - the result, not the hardware.',
  },
  {
    key: 'security-one-app',
    id: 'photo-1783419036401-1c01c1039267',
    note: 'Hands holding a phone running an app. Hands only, no face.',
  },
  {
    key: 'security-home',
    id: 'photo-1570129477492-45c003edd2be',
    note: 'Detached family house in daylight. The residential path.',
  },
  {
    key: 'security-business',
    id: 'photo-1497366754035-f200968a6e72',
    note: 'Empty modern office interior. The commercial path. No people.',
  },

  /* ------------------------------------------------- security: products */
  {
    key: 'product-iq-panel-4',
    id: 'photo-1605191737149-caf33c6efdd1',
    note: 'A wall-mounted touchscreen being operated. Stands in for the control panel.',
  },
  {
    key: 'product-outdoor-cameras',
    id: 'photo-1774818803625-7a46ca67cc13',
    note: 'Bullet camera on a plain ground. Reads as a product shot.',
  },
  {
    key: 'product-indoor-cameras',
    id: 'photo-1730967693281-c114d9930860',
    note: 'White pan/tilt indoor camera on a table.',
  },
  {
    key: 'product-video-doorbells',
    id: 'photo-1633194883650-df448a10d554',
    note: 'Doorbell camera on a textured exterior wall.',
  },
  {
    key: 'product-smart-locks',
    id: 'photo-1662106088835-2ac8adea34dd',
    note: 'Keypad lock on a door. No hands, no branding.',
  },
  {
    key: 'product-sensors',
    id: 'photo-1549884784-d66096288100',
    note: 'Ceiling motion detector dome.',
  },
  {
    key: 'product-smoke-co',
    id: 'photo-1691465576659-938b08b99959',
    note: 'Flush ceiling detector. Deliberately undramatic.',
  },

  /* ------------------------------- security: representative install work */
  {
    key: 'install-1',
    id: 'photo-1774977863604-59f4e6d37a90',
    note: 'A technician on a ladder at a ceiling. NOT a TKG job - see the header note.',
  },
  {
    key: 'install-2',
    id: 'photo-1767059439630-ca3844d07d77',
    note: 'A camera mounted flush to a white ceiling. Finished work, no people.',
  },
  {
    key: 'install-3',
    id: 'photo-1677919327739-de8da923a5d9',
    note: 'A smart lock fitted to a door. Finished work, no people.',
  },

  /* ------------------------------------------------------------ vehicles */
  {
    key: 'automotive-hero',
    id: 'photo-1760465066570-6c2261f851e6',
    full: WIDE,
    note: 'A line of vehicles outdoors. Deliberately NOT a branded dealership forecourt - TKG sources, it does not sell.',
  },
  {
    key: 'automotive-sell',
    id: 'photo-1761014586555-947a9555d302',
    note: 'A key fob held out over a plain ground. Hands only.',
  },

  /* ------------------------------------------------------------- careers */
  {
    key: 'careers-hero',
    id: 'photo-1504384308090-c894fdcc538d',
    full: WIDE,
    note: 'Open-plan office, shot wide so no individual is the subject.',
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
  const spec = image.full ?? FULL;

  const full = await grab(url(image.id, spec));
  writeFileSync(join(OUT, `${image.key}.jpg`), full);

  const blur = await grab(url(image.id, BLUR));

  manifest[image.key] = {
    src: `/media/${image.key}.jpg`,
    width: spec.w,
    height: spec.h,
    blurDataURL: `data:image/jpeg;base64,${blur.toString('base64')}`,
    unsplashId: image.id,
    credit: '[PHOTOGRAPHER]',
  };

  const kb = (n) => `${Math.round(n / 1024)}kB`;
  console.log(`${image.key.padEnd(26)} ${kb(full.length).padStart(7)}`);
}

writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nWrote ${IMAGES.length} images + manifest.json to public/media/`);
