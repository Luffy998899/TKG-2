/* =========================================================================
   Verifies every text/background pair in the design system against WCAG 2.1.

   Run:  node scripts/check-contrast.mjs

   Reads the hex values straight out of src/config/theme.ts and
   src/config/divisions.ts, so it can never drift from what ships. Exits
   non-zero on any failure — safe to wire into CI.
   ========================================================================= */

import { readFileSync } from 'node:fs';

const hexToRgb = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};

const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const themeSrc = readFileSync(new URL('../src/config/theme.ts', import.meta.url), 'utf8');
const divisionsSrc = readFileSync(new URL('../src/config/divisions.ts', import.meta.url), 'utf8');

const HEX = String.raw`\s*'(#[0-9a-fA-F]{6})'`;

const grab = (name) => {
  const m = themeSrc.match(new RegExp(name + ':' + HEX));
  if (!m) throw new Error(`theme.ts is missing \`${name}\``);
  return m[1];
};

const base = Object.fromEntries(
  ['paper', 'paperRaised', 'paperSunk', 'ink', 'inkSoft', 'inkMute', 'line',
   'night', 'nightSoft', 'nightLine']
    .map((k) => [k, grab(k)]),
);

const rows = [];
const check = (label, fg, bg, min) => {
  const r = ratio(fg, bg);
  rows.push({ label, ratio: r, min, pass: r >= min });
};

/* ------------------------------------------------------------------ base -- */

check('ink on paper', base.ink, base.paper, 7);
check('ink on paperRaised', base.ink, base.paperRaised, 7);
check('inkSoft on paper', base.inkSoft, base.paper, 4.5);
check('inkSoft on paperSunk', base.inkSoft, base.paperSunk, 4.5);
check('inkMute on paper', base.inkMute, base.paper, 4.5);
check('inkMute on paperSunk', base.inkMute, base.paperSunk, 4.5);
check('paper on night', base.paper, base.night, 7);
check('paper on nightSoft', base.paper, base.nightSoft, 7);

/* -------------------------------------------------------------- accents -- */

const blockRe = new RegExp(
  String.raw`slug:\s*'([a-z-]+)'[\s\S]*?accent:` + HEX +
  String.raw`[\s\S]*?accentInk:` + HEX +
  String.raw`[\s\S]*?accentSoft:` + HEX +
  String.raw`[\s\S]*?accentContrast:` + HEX +
  String.raw`[\s\S]*?accentBright:` + HEX,
  'g',
);

const blocks = [
  ...divisionsSrc.matchAll(blockRe),
  // The site-wide default accent, which lives in theme.ts.
  (() => {
    const m = themeSrc.match(
      new RegExp(
        String.raw`defaultTheme[\s\S]*?accent:` + HEX +
        String.raw`[\s\S]*?accentInk:` + HEX +
        String.raw`[\s\S]*?accentSoft:` + HEX +
        String.raw`[\s\S]*?accentContrast:` + HEX +
        String.raw`[\s\S]*?accentBright:` + HEX,
      ),
    );
    return m && [m[0], 'default', m[1], m[2], m[3], m[4], m[5]];
  })(),
].filter(Boolean);

if (blocks.length < 8) {
  throw new Error(`Expected 8 accent sets (7 divisions + default), found ${blocks.length}`);
}

for (const [, slug, accent, accentInk, accentSoft, accentContrast, accentBright] of blocks) {
  // Text on a solid accent fill (buttons, badges).
  check(`${slug}: accentContrast on accent`, accentContrast, accent, 4.5);
  // Accent used as text on the page ground.
  check(`${slug}: accentInk on paper`, accentInk, base.paper, 4.5);
  check(`${slug}: accentInk on paperRaised`, accentInk, base.paperRaised, 4.5);
  // Accent used as text on its own tint.
  check(`${slug}: accentInk on accentSoft`, accentInk, accentSoft, 4.5);
  check(`${slug}: ink on accentSoft`, base.ink, accentSoft, 7);
  // Accent as a non-text UI boundary (focus ring, active rule): 3:1.
  check(`${slug}: accent on paper (UI 3:1)`, accent, base.paper, 3);
  // The bright form exists only for the dark ground - the hero and CTA band.
  check(`${slug}: accentBright on night`, accentBright, base.night, 4.5);
  check(`${slug}: accentBright on nightSoft`, accentBright, base.nightSoft, 4.5);
}

/* ----------------------------------------------------------------- print -- */

const width = Math.max(...rows.map((r) => r.label.length));
const failed = rows.filter((r) => !r.pass);

for (const r of rows) {
  console.log(
    `${r.pass ? 'ok  ' : 'FAIL'} ${r.label.padEnd(width)}  ` +
    `${r.ratio.toFixed(2).padStart(6)}:1  (min ${r.min})`,
  );
}

console.log(`\n${rows.length - failed.length}/${rows.length} pass`);
process.exit(failed.length ? 1 : 0);
