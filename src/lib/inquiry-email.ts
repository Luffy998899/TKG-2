/* =========================================================================
   The inquiry notification email.

   Kept out of the API route so it can be rendered and looked at without
   sending anything - see scripts/preview-inquiry-email.mjs. It deliberately
   imports NOTHING from the app, so that preview is one command with no build
   step; the only thing it would have taken from config is the brand name,
   which is the constant below.

   WHY IT IS BUILT FROM TABLES. Email is not the web. Gmail strips <style>
   blocks, Outlook renders through Word and ignores max-width on a <div>,
   and neither supports flex or grid. Nested tables with inline styles and
   explicit widths are the only layout that survives all of them, which is
   why this looks like markup from 2005 on purpose.
   ========================================================================= */

/** Palette, matching the site's tokens. Hex, because email has no variables. */
const C = {
  page: '#EFECE5',
  card: '#FFFFFF',
  ink: '#1C1A17',
  inkSoft: '#55504A',
  inkMute: '#6F6960',
  line: '#DFDAD1',
  accent: '#1F5CA8',
  accentSoft: '#E6EDF7',
  danger: '#A32F2A',
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Who the mail says it is from, in the footer line. */
const BRAND = 'TKG Ventures';

/** Fields that are contact details, promoted to the top and made clickable. */
const CONTACT_FIELDS = new Set(['name', 'fullName', 'phone', 'email', 'company']);

/** Fields rendered as a full-width block because the answer is a paragraph. */
const LONG_FIELDS = new Set(['details', 'message', 'items', 'experience', 'notes']);

/** Rendered as a block once a value is longer than this, whatever its name. */
const LONG_VALUE_CHARS = 60;

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Turns "pickupAddress" into "Pickup address". */
export const humanise = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

/** A readable label for a value that may be a string, an array or a file. */
export function present(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === 'object' && 'name' in item
          ? String((item as { name: unknown }).name)
          : String(item),
      )
      .join(', ');
  }
  if (value && typeof value === 'object' && 'name' in value) {
    return String((value as { name: unknown }).name);
  }
  return String(value);
}

/** "division:security-smart-home" -> "Security & Smart Home"-ish. */
export const topicOf = (source: string): string =>
  humanise((source.split(':')[1] ?? source).replace(/-/g, ' '));

/**
 * Makes a value actionable where it can be. A phone number in an email that
 * cannot be tapped is a phone number that gets copied out by hand.
 */
function linkify(field: string, value: string): string {
  const safe = escapeHtml(value);
  const link = (href: string) =>
    `<a href="${href}" style="color:${C.accent};text-decoration:none">${safe}</a>`;

  if (field === 'email' && value.includes('@')) return link(`mailto:${value}`);
  if (field === 'phone' || field.endsWith('Phone')) {
    const digits = value.replace(/[^\d+]/g, '');
    if (digits.length >= 7) return link(`tel:${digits}`);
  }
  if (/address/i.test(field) && value.length > 6) {
    return link(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`);
  }
  return safe;
}

/** A date-only answer from a <input type="date">, written out in full. */
function formatDateOnly(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  // Constructed as UTC and read back as UTC: a bare date has no timezone, and
  // parsing it as local time slides it a day in half the world.
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.toLocaleDateString('en-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-CA', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Vancouver',
  });
}

/** One label/value pair, side by side. */
const row = (label: string, valueHtml: string, last: boolean): string => `
  <tr>
    <td style="padding:14px 0 14px 24px;${last ? '' : `border-bottom:1px solid ${C.line};`}font-family:${FONT};font-size:13px;line-height:20px;color:${C.inkMute};vertical-align:top;width:150px" width="150">${label}</td>
    <td style="padding:14px 24px 14px 16px;${last ? '' : `border-bottom:1px solid ${C.line};`}font-family:${FONT};font-size:15px;line-height:22px;color:${C.ink};font-weight:600;vertical-align:top">${valueHtml}</td>
  </tr>`;

/** One label/value pair, stacked, for anything paragraph-length. */
const block = (label: string, valueHtml: string, last: boolean): string => `
  <tr>
    <td colspan="2" style="padding:14px 24px;${last ? '' : `border-bottom:1px solid ${C.line};`}font-family:${FONT};vertical-align:top">
      <div style="font-size:13px;line-height:20px;color:${C.inkMute};margin-bottom:6px">${label}</div>
      <div style="font-size:15px;line-height:23px;color:${C.ink};white-space:pre-wrap">${valueHtml}</div>
    </td>
  </tr>`;

export interface InquiryEmailInput {
  id: string;
  source: string;
  /**
   * What to call this inquiry, e.g. "Moving & Delivery". The caller resolves
   * it from the divisions config; without one, the slug is humanised, which
   * turns "moving-delivery" into the slightly wrong "Moving delivery".
   */
  topic?: string;
  submittedAt: string;
  /** Already filtered of empties, in the order they should appear. */
  entries: [string, unknown][];
  attachedNames?: string[];
  skippedCount?: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  /** The customer's own address, for Reply-To. */
  replyTo?: string;
}

export function renderInquiryEmail(input: InquiryEmailInput): RenderedEmail {
  const { id, source, submittedAt, entries } = input;
  const attachedNames = input.attachedNames ?? [];
  const skippedCount = input.skippedCount ?? 0;

  const lookup = new Map(entries);
  const topic = input.topic ?? topicOf(source);
  const who = ['name', 'fullName']
    .map((k) => lookup.get(k))
    .find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  const replyTo = typeof lookup.get('email') === 'string' ? (lookup.get('email') as string) : undefined;

  /*
   * Contact details first, then everything else in form order, then the
   * paragraph-length answers last. Whoever opens this is deciding whether to
   * pick up the phone; the number should not be below a list of checkboxes.
   */
  const contact = entries.filter(([field]) => CONTACT_FIELDS.has(field));
  const rest = entries.filter(
    ([field, value]) =>
      !CONTACT_FIELDS.has(field) &&
      !(LONG_FIELDS.has(field) || present(value).length > LONG_VALUE_CHARS),
  );
  const long = entries.filter(
    ([field, value]) =>
      !CONTACT_FIELDS.has(field) &&
      (LONG_FIELDS.has(field) || present(value).length > LONG_VALUE_CHARS),
  );
  const ordered = [...contact, ...rest, ...long];

  const bodyRows = ordered
    .map(([field, value], index) => {
      const label = escapeHtml(humanise(field));
      const raw = formatDateOnly(present(value));
      const last = index === ordered.length - 1 && attachedNames.length === 0 && !skippedCount;
      const isLong = LONG_FIELDS.has(field) || raw.length > LONG_VALUE_CHARS;
      return isLong
        ? block(label, escapeHtml(raw), last)
        : row(label, linkify(field, raw), last);
    })
    .join('');

  const attachmentRow = attachedNames.length
    ? block(
        `Attached ${attachedNames.length === 1 ? 'file' : 'files'}`,
        attachedNames.map((n) => escapeHtml(n)).join('<br>'),
        !skippedCount,
      )
    : '';

  const skippedRow = skippedCount
    ? `<tr><td colspan="2" style="padding:14px 24px;font-family:${FONT};font-size:14px;line-height:21px;color:${C.danger}">${skippedCount} file${skippedCount === 1 ? ' was' : 's were'} too large to attach. Open the inquiry in /admin to download ${skippedCount === 1 ? 'it' : 'them'}.</td></tr>`
    : '';

  const callButton =
    typeof lookup.get('phone') === 'string'
      ? `<a href="tel:${String(lookup.get('phone')).replace(/[^\d+]/g, '')}" style="display:inline-block;background:${C.ink};color:#FFFFFF;font-family:${FONT};font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:999px">Call ${escapeHtml(who ?? 'them')}</a>`
      : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>New ${escapeHtml(topic)} inquiry</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<!-- Preheader: the grey line a client shows next to the subject. Hidden in the body. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(
    [who, present(lookup.get('phone') ?? ''), topic].filter(Boolean).join(' · '),
  )}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};padding:0;margin:0">
  <tr>
    <td align="center" style="padding:28px 12px">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${C.card};border:1px solid ${C.line};border-radius:16px;overflow:hidden">

        <!-- header -->
        <tr>
          <td style="padding:26px 24px 22px;background:${C.ink}">
            <div style="font-family:${FONT};font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,0.6);font-weight:600">New inquiry</div>
            <div style="font-family:${FONT};font-size:24px;line-height:30px;color:#FFFFFF;font-weight:700;margin-top:8px">${escapeHtml(topic)}</div>
            <div style="font-family:${FONT};font-size:13px;line-height:19px;color:rgba(255,255,255,0.62);margin-top:8px">${escapeHtml(formatDate(submittedAt))}</div>
          </td>
        </tr>

        <!-- the answers -->
        <tr>
          <td style="padding:0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${bodyRows}${attachmentRow}${skippedRow}
            </table>
          </td>
        </tr>

        <!-- actions -->
        ${
          callButton || replyTo
            ? `<tr>
          <td style="padding:22px 24px;background:${C.accentSoft};border-top:1px solid ${C.line}">
            ${callButton}
            <div style="font-family:${FONT};font-size:13px;line-height:20px;color:${C.inkSoft};margin-top:${callButton ? '14px' : '0'}">
              ${replyTo ? `Replying to this email goes straight to <strong style="color:${C.ink}">${escapeHtml(replyTo)}</strong>.` : 'No email address was given, so reply by phone.'}
            </div>
          </td>
        </tr>`
            : ''
        }

        <!-- footer -->
        <tr>
          <td style="padding:18px 24px;border-top:1px solid ${C.line}">
            <div style="font-family:${FONT};font-size:12px;line-height:18px;color:${C.inkMute}">
              Sent by the ${BRAND} website · Reference ${escapeHtml(id)}
            </div>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;

  /*
   * The plain-text alternative. Not a fallback nobody reads: it is what a
   * watch, a screen reader and a spam filter look at, and a message with no
   * text part scores worse for deliverability.
   */
  const text = [
    `NEW ${topic.toUpperCase()} INQUIRY`,
    formatDate(submittedAt),
    '',
    ...ordered.map(([field, value]) => `${humanise(field)}: ${present(value)}`),
    ...(attachedNames.length ? ['', `Attached: ${attachedNames.join(', ')}`] : []),
    ...(skippedCount ? [`${skippedCount} file(s) too large to attach - see /admin.`] : []),
    '',
    replyTo ? `Reply to this email to answer ${who ?? 'them'} directly (${replyTo}).` : '',
    `Reference ${id}`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return {
    subject: `New ${topic} inquiry${who ? ` from ${who}` : ''}`,
    html,
    text,
    replyTo,
  };
}
