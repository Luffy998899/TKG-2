/* =========================================================================
   Imports the business's OWN photography, replacing the stock stand-ins.

   Run:  node scripts/import-photos.mjs

   HOW TO USE IT
   -------------
   1. Save your photos into  photos-in/  at the project root, named exactly
      as listed in TARGETS below (any of .jpg .jpeg .png .webp).
   2. Run the command.
   3. Commit the changed files under public/ and deploy.

   It resizes each photo to the size that slot actually needs, writes the
   WebGL texture where one is required, generates the blur placeholder that
   next/image shows while the real file loads, and updates the manifest with
   the true dimensions. Nothing in any component hardcodes a filename, so
   this is the whole job.

   Only the photos you provide are touched. A slot with no file in photos-in/
   is skipped and keeps whatever it has, so you can do these a few at a time.
   ========================================================================= */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN = join(ROOT, 'photos-in');
const DIVISIONS = join(ROOT, 'public', 'divisions');
const MEDIA = join(ROOT, 'public', 'media');

/**
 * Which file replaces which picture on the site.
 *
 * `name`     what to call the file you drop into photos-in/
 * `key`      the manifest entry it becomes
 * `dir`      which public folder it belongs in
 * `size`     what it is resized to
 * `texture`  division images are also painted onto the 3D slab, which needs
 *            its own small copy - three.js cannot read next/image's output
 * `fit`      'cover' crops to fill the frame; 'contain' pads instead, which
 *            is right for a product shot that must not lose its edges
 */
const TARGETS = [
  {
    name: 'security-smart-home',
    key: 'security-smart-home',
    dir: DIVISIONS,
    size: { w: 1600, h: 1000 },
    texture: { w: 512, h: 320 },
    fit: 'cover',
    note: 'The Security & Smart Home division photo: homepage card, 3D slab and page hero.',
  },
  {
    name: 'product-iq-panel-4',
    key: 'product-iq-panel-4',
    dir: MEDIA,
    size: { w: 1600, h: 1000 },
    fit: 'contain',
    note: 'Smart Panel.',
  },
  {
    name: 'product-outdoor-cameras',
    key: 'product-outdoor-cameras',
    dir: MEDIA,
    size: { w: 1600, h: 1000 },
    fit: 'contain',
    note: 'Outdoor Cameras.',
  },
  {
    name: 'product-indoor-cameras',
    key: 'product-indoor-cameras',
    dir: MEDIA,
    size: { w: 1600, h: 1000 },
    fit: 'contain',
    note: 'Indoor Cameras.',
  },
  {
    name: 'product-video-doorbells',
    key: 'product-video-doorbells',
    dir: MEDIA,
    size: { w: 1600, h: 1000 },
    fit: 'contain',
    note: 'Video Doorbell.',
  },
  {
    name: 'product-smart-locks',
    key: 'product-smart-locks',
    dir: MEDIA,
    size: { w: 1600, h: 1000 },
    fit: 'contain',
    note: 'Door Lock.',
  },
  {
    name: 'product-sensors',
    key: 'product-sensors',
    dir: MEDIA,
    size: { w: 1600, h: 1000 },
    fit: 'contain',
    note: 'Sensors.',
  },
];

const ACCEPTED = ['.jpg', '.jpeg', '.png', '.webp'];

/** The pad colour behind a `contain` product shot. Matches --paper-raised. */
const PAD = { r: 250, g: 249, b: 246, alpha: 1 };

function findSource(name) {
  if (!existsSync(IN)) return null;
  for (const file of readdirSync(IN)) {
    const ext = extname(file).toLowerCase();
    if (!ACCEPTED.includes(ext)) continue;
    if (file.slice(0, -ext.length).toLowerCase() === name) return join(IN, file);
  }
  return null;
}

const readManifest = (dir) => {
  const path = join(dir, 'manifest.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
};

async function render(source, { w, h }, fit) {
  return sharp(source)
    .rotate() // Honour the EXIF orientation a phone writes, then drop it.
    .resize(w, h, { fit, background: PAD })
    .flatten({ background: PAD }) // PNG transparency onto the page colour.
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

/** The low-quality placeholder next/image shows during load. */
async function blur(source, fit) {
  const buffer = await sharp(source)
    .rotate()
    .resize(12, 8, { fit, background: PAD })
    .flatten({ background: PAD })
    .jpeg({ quality: 40 })
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

mkdirSync(IN, { recursive: true });

const manifests = new Map();
const done = [];
const missing = [];

for (const target of TARGETS) {
  const source = findSource(target.name);
  if (!source) {
    missing.push(target);
    continue;
  }

  const full = await render(source, target.size, target.fit);
  writeFileSync(join(target.dir, `${target.key}.jpg`), full);

  /*
   * A cache-busting stamp taken from the bytes we just wrote.
   *
   * The filename stays the same when a photo is replaced, so every cache
   * between the file and the viewer - the Next image optimiser, the CDN, and
   * the browser that already downloaded the old one - has no way to know it
   * changed. That is why a replaced picture shows up in some places and not
   * others. `?v=` in the URL changes with the content, so a new photo is a
   * new URL and every one of those caches misses correctly.
   */
  const folder = target.dir === DIVISIONS ? 'divisions' : 'media';
  const version = createHash('sha1').update(full).digest('hex').slice(0, 8);

  const entry = {
    src: `/${folder}/${target.key}.jpg?v=${version}`,
    width: target.size.w,
    height: target.size.h,
    blurDataURL: await blur(source, target.fit),
    version,
  };

  if (target.texture) {
    const tex = await render(source, target.texture, target.fit);
    writeFileSync(join(target.dir, `${target.key}-tex.jpg`), tex);
    entry.texture = `/divisions/${target.key}-tex.jpg?v=${version}`;
  }

  if (!manifests.has(target.dir)) manifests.set(target.dir, readManifest(target.dir));
  const manifest = manifests.get(target.dir);
  // Keep any credit already recorded; the picture changed, not the paperwork.
  manifest[target.key] = { ...manifest[target.key], ...entry };

  done.push(`${target.key.padEnd(26)} ${Math.round(full.length / 1024)}kB`);
}

for (const [dir, manifest] of manifests) {
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

if (done.length) {
  console.log(`Imported ${done.length} photo${done.length === 1 ? '' : 's'}:`);
  for (const line of done) console.log(`  ${line}`);
} else {
  console.log('Nothing imported.');
}

if (missing.length) {
  console.log(`\nStill waiting for ${missing.length} file(s) in photos-in/:`);
  for (const target of missing) {
    console.log(`  ${target.name}.jpg`.padEnd(34) + target.note);
  }
}
