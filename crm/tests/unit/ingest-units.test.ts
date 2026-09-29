import { describe, expect, it } from 'vitest';
import { signBody, verifySignature } from '@/lib/ingest/signature';
import { extractCustomer, isSalesSource, pipelineSlugFor, serviceSummary } from '@/lib/ingest/mapping';
import { searchDigits, toE164 } from '@/lib/phone';
import { sniffMime } from '@/lib/files/sniff';

const SECRET = 'x'.repeat(40);
const body = new TextEncoder().encode('{"v":1}');
const now = 1_790_000_000;

describe('ingest signature', () => {
  it('accepts a fresh, correctly signed body', () => {
    const result = verifySignature(body, String(now), signBody(SECRET, now, body), [SECRET], now + 10);
    expect(result.ok).toBe(true);
  });

  it('rejects a bad signature, a changed body, and a wrong secret', () => {
    const good = signBody(SECRET, now, body);
    expect(verifySignature(body, String(now), `v1=${'0'.repeat(64)}`, [SECRET], now)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifySignature(new TextEncoder().encode('{"v":2}'), String(now), good, [SECRET], now)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifySignature(body, String(now), good, ['y'.repeat(40)], now)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a timestamp older than 5 minutes or from the future', () => {
    const sig = signBody(SECRET, now, body);
    expect(verifySignature(body, String(now), sig, [SECRET], now + 301)).toEqual({ ok: false, reason: 'stale' });
    expect(verifySignature(body, String(now), sig, [SECRET], now - 31)).toEqual({ ok: false, reason: 'stale' });
  });

  it('rejects missing or malformed headers', () => {
    expect(verifySignature(body, null, 'v1=abc', [SECRET], now)).toEqual({ ok: false, reason: 'missing' });
    expect(verifySignature(body, String(now), 'sha256=abc', [SECRET], now)).toEqual({ ok: false, reason: 'missing' });
  });

  it('accepts the previous secret during rotation', () => {
    const old = 'o'.repeat(40);
    expect(verifySignature(body, String(now), signBody(old, now, body), [SECRET, old], now).ok).toBe(true);
  });
});

describe('what becomes a lead, and where', () => {
  it('never accepts careers or unknown sources', () => {
    expect(isSalesSource('careers:sales-representative')).toBe(false);
    expect(isSalesSource('careers:unspecified')).toBe(false);
    expect(isSalesSource('page:about')).toBe(false);
    expect(isSalesSource('division:cleaning')).toBe(true);
    expect(isSalesSource('automotive:selling')).toBe(true);
    expect(isSalesSource('page:quote')).toBe(true);
  });

  it('routes each form to its pipeline, general forms to General unless a division was picked', () => {
    expect(pipelineSlugFor('division:telecommunications', {})).toBe('telecommunications');
    expect(pipelineSlugFor('automotive:sourcing', {})).toBe('automotive');
    expect(pipelineSlugFor('page:quote', { division: 'cleaning' })).toBe('cleaning');
    expect(pipelineSlugFor('page:quote', { division: 'not-sure' })).toBe('general');
    expect(pipelineSlugFor('page:contact', { division: 'general' })).toBe('general');
    expect(pipelineSlugFor('page:contact', {})).toBe('general');
  });

  it('finds the person whichever field names the form uses', () => {
    expect(extractCustomer({ name: ' Jo ', email: 'JO@X.CA', phone: '604 555 0199', pickupAddress: '1 Main St' })).toEqual({
      full_name: 'Jo', email: 'jo@x.ca', phone_raw: '604 555 0199', address: '1 Main St', city: '',
    });
    expect(extractCustomer({ name: 'A', siteAddress: '9 Site Rd', location: 'Surrey' }).address).toBe('9 Site Rd');
  });

  it('summarises the service from the labelled answers', () => {
    expect(serviceSummary('division:telecommunications', [['lookingFor', 'Internet + TV'], ['accountType', 'Home']])).toBe('Internet + TV · Home');
    expect(serviceSummary('automotive:selling', [['make', 'Honda'], ['model', 'Civic'], ['year', '2018']])).toBe('Selling a vehicle · Honda · Civic · 2018');
  });
});

describe('phone normalisation', () => {
  it('makes every Canadian format the same E.164 number', () => {
    for (const raw of ['604-555-0199', '(604) 555 0199', '+1 604 555 0199', '16045550199', '604.555.0199']) {
      expect(toE164(raw)).toBe('+16045550199');
    }
    expect(toE164('123')).toBeNull();
    expect(toE164('')).toBeNull();
  });

  it('strips formatting and a leading 1 for search', () => {
    expect(searchDigits('+1 (604) 555-0199')).toBe('6045550199');
    expect(searchDigits('555-01')).toBe('55501');
  });
});

describe('file sniffing (Q8)', () => {
  const bytes = (...values: (number | string)[]) =>
    new Uint8Array(values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])));

  it('recognises the five allowed types by their bytes', () => {
    expect(sniffMime(bytes('%PDF-1.7'))).toBe('application/pdf');
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffMime(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffMime(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('image/webp');
    expect(sniffMime(bytes(0, 0, 0, 24, 'ftyp', 'heic'))).toBe('image/heic');
    expect(sniffMime(bytes(0, 0, 0, 24, 'ftyp', 'mif1'))).toBe('image/heif');
  });

  it('refuses anything else, whatever its name says', () => {
    expect(sniffMime(bytes('MZ', 0x90, 0))).toBeNull(); // a Windows executable renamed .pdf
    expect(sniffMime(bytes('<html>'))).toBeNull();
    expect(sniffMime(bytes('PK', 3, 4))).toBeNull(); // .docx / zip
  });
});
