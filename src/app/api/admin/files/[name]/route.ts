import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/admin-auth';
import { openUpload } from '@/lib/store';

/**
 * Downloads a stored upload (a resume, typically). Owner-only: the file was
 * sent to the business by an applicant, and nothing about its random name
 * should be treated as a secret.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export async function GET(request: Request, { params }: { params: { name: string } }) {
  if (!isAuthenticated()) return new NextResponse('Not authorised.', { status: 401 });

  const download = new URL(request.url).searchParams.get('as') ?? params.name;

  try {
    const { stream, size, ext } = await openUpload(params.name);
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'Content-Length': String(size),
        // The original filename is a browser-supplied string; quote and strip
        // anything that could break the header.
        'Content-Disposition': `attachment; filename="${download.replace(/[^\w. -]/g, '_')}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new NextResponse('Not found.', { status: 404 });
  }
}
