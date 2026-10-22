import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Tiny placeholders were carrying full ICC profiles. Strip metadata and encode
// only the tiny preview, keeping the source photographs and dimensions intact.
let before = 0;
let after = 0;
let changed = 0;
for (const path of ['../public/divisions/manifest.json', '../public/media/manifest.json']) {
  const url = new URL(path, import.meta.url);
  const manifest = JSON.parse(await readFile(url, 'utf8'));
  for (const image of Object.values(manifest)) {
    if (!image.blurDataURL?.startsWith('data:image/')) continue;
    const original = image.blurDataURL;
    before += original.length;
    const bytes = Buffer.from(original.slice(original.indexOf(',') + 1), 'base64');
    const optimized = await sharp(bytes).resize({ width: 12, withoutEnlargement: true }).webp({ quality: 25 }).toBuffer();
    const candidate = `data:image/webp;base64,${optimized.toString('base64')}`;
    if (candidate.length < original.length) { image.blurDataURL = candidate; changed++; }
    after += image.blurDataURL.length;
  }
  await writeFile(url, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(`Optimized ${changed} placeholders: ${before} → ${after} characters (${Math.round((1 - after / before) * 100)}% smaller).`);
