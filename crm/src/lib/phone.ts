import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Canadian-first phone normalisation. "604 555 0199", "(604) 555-0199" and
 * "+1 604-555-0199" all become +16045550199, which is what customer dedupe
 * and search match on.
 */
export function toE164(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(value, 'CA');
  return parsed?.isValid() ? parsed.number : null;
}

/** Digits for format-agnostic search; drops a leading North American 1. */
export function searchDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

/** For display and tel: links. */
export function formatPhone(e164: string | null | undefined, raw?: string | null): string {
  if (e164) {
    const parsed = parsePhoneNumberFromString(e164);
    if (parsed) return parsed.country === 'CA' || parsed.country === 'US' ? parsed.formatNational() : parsed.formatInternational();
  }
  return raw ?? '';
}
