import { NextResponse } from 'next/server';
import { readOverrides, openUpload } from '@/lib/store';

/**
 * Serves the favicon the owner uploaded from /admin. The root layout points
 * `metadata.icons` here only when an upload exists; otherwise the static
 * src/app/icon.svg is used and this route is never requested.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export async function GET() {
  const { favicon } = await readOverrides();
  if (!favicon) return new NextResponse(null, { status: 404 });

  try {
    const { stream, size, ext } = await openUpload(favicon);
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'Content-Length': String(size),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
