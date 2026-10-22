import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const output = fileURLToPath(new URL('../public/og/tkg-ventures.png', import.meta.url));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#172124"/>
<rect x="72" y="68" width="64" height="5" fill="#a8c6b4"/>
<g font-family="Arial, sans-serif" fill="#f7f5f1">
<text x="72" y="126" font-size="28" letter-spacing="4" fill="#a8c6b4">TKG VENTURES LTD</text>
<text x="72" y="260" font-size="68" font-weight="700">One team for your</text>
<text x="72" y="340" font-size="68" font-weight="700">home and business.</text>
<text x="72" y="410" font-size="28" fill="#cbd4cf">Security · Internet &amp; TV · Moving · Cleaning · Staffing</text>
<path d="M72 495H1128" stroke="#52605a"/>
<text x="72" y="550" font-size="24">Lower Mainland &amp; Fraser Valley, BC</text>
<text x="1128" y="550" font-size="24" text-anchor="end">tkgventuresltd.ca</text>
</g></svg>`;
await mkdir(new URL('../public/og/', import.meta.url), { recursive: true });
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(output);
console.log('Generated public/og/tkg-ventures.png (1200 × 630).');
