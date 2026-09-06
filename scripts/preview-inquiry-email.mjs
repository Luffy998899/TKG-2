/* =========================================================================
   Renders the inquiry notification email to a file, so it can be looked at
   in a browser without sending anything.

   Run:  node --experimental-strip-types scripts/preview-inquiry-email.mjs
   Then open the file it prints.

   An email you cannot see before it goes out is an email nobody checks. This
   builds two realistic samples - a short contact message and a full division
   inquiry with attachments - from the same renderer the API route uses, so
   what you see here is what lands in the inbox.
   ========================================================================= */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.preview');

// Imported straight from source. The renderer has no app imports, so Node's
// own type stripping is enough and there is no build step to keep in sync.
const { renderInquiryEmail } = await import('../src/lib/inquiry-email.ts');

const SAMPLES = [
  {
    file: 'inquiry-contact.html',
    input: {
      id: 'a1b2c3d4-0000-4444-8888-abcdefabcdef',
      source: 'contact',
      topic: 'Contact form',
      submittedAt: new Date().toISOString(),
      entries: [
        ['name', 'Eva Bansal'],
        ['email', 'evabansal15@gmail.com'],
        ['phone', '(778) 527-9027'],
        ['division', 'Telecommunications'],
        ['details', 'Need wifi at home'],
      ],
    },
  },
  {
    file: 'inquiry-division.html',
    input: {
      id: 'ffeeddcc-1111-4444-9999-0123456789ab',
      source: 'division:moving-delivery',
      topic: 'Moving & Delivery',
      submittedAt: new Date().toISOString(),
      entries: [
        ['name', 'Jordan Alvarez'],
        ['email', 'jordan@example.com'],
        ['phone', '(604) 555-0142'],
        ['jobType', 'Small / residential move'],
        ['pickupAddress', '1940 Westbury Avenue, Abbotsford, British Columbia, V2S 1C1'],
        ['dropoffAddress', '13450 104 Avenue, Surrey, British Columbia, V3T 1V8'],
        ['date', '2026-09-20'],
        ['access', 'Stairs involved'],
        [
          'items',
          '3-seat sofa, queen bed frame and mattress, 8 boxes, a fridge.\nThe sofa will not fit down the stairwell, so it has to come off the balcony.',
        ],
      ],
      attachedNames: ['living-room.jpg', 'stairwell.jpg'],
      skippedCount: 1,
    },
  },
];

mkdirSync(OUT, { recursive: true });

for (const sample of SAMPLES) {
  const { subject, html, text } = renderInquiryEmail(sample.input);
  writeFileSync(join(OUT, sample.file), html);
  writeFileSync(join(OUT, sample.file.replace('.html', '.txt')), `Subject: ${subject}\n\n${text}`);
  console.log(`${sample.file.padEnd(26)} ${subject}`);
}

console.log(`\nWritten to ${OUT}`);
