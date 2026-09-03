import { NextResponse } from 'next/server';

/**
 * Inquiry intake stub.
 *
 * TODO: connect email/CRM.
 * This route deliberately does not persist anything. Wire it to whichever of
 * these the business actually uses, then delete this comment:
 *   - transactional email (Resend / Postmark / SendGrid) to site.contact.email
 *   - a CRM webhook (HubSpot, Zoho, Pipedrive)
 *   - a spreadsheet or database row
 *
 * Before going live also add: a rate limit per IP, and a real spam check
 * (the client already sends a honeypot field, `company_website`).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface InquiryPayload {
  source?: string;
  submittedAt?: string;
  values?: Record<string, unknown>;
}

export async function POST(request: Request) {
  let payload: InquiryPayload;

  try {
    payload = (await request.json()) as InquiryPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const values = payload.values ?? {};

  // Honeypot: a real person leaves this empty. Return 200 so a bot cannot tell
  // it was caught, but do nothing with the submission.
  if (typeof values.company_website === 'string' && values.company_website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  // Server-side shape check. The client validates against the same config, but
  // an API route must never trust the client.
  if (!payload.source || typeof values !== 'object') {
    return NextResponse.json({ ok: false, error: 'Malformed inquiry.' }, { status: 400 });
  }

  // eslint-disable-next-line no-console -- placeholder sink until email/CRM is wired up
  console.info('[inquiry]', {
    source: payload.source,
    submittedAt: payload.submittedAt ?? new Date().toISOString(),
    values,
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Use POST.' }, { status: 405 });
}
