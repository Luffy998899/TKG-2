import { formatDistanceToNowStrict } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/** Everything the business sees is in Vancouver time and Canadian dollars. */
export const TIME_ZONE = 'America/Vancouver';

const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const cadWhole = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });

export const money = (cents: number | null | undefined): string => (cents == null ? '—' : cad.format(cents / 100));
export const moneyWhole = (cents: number | null | undefined): string => (cents == null ? '—' : cadWhole.format(cents / 100));

/** "$1,234.50" or "1234.5" typed by a person -> cents, or null. */
export function parseMoney(input: string | null | undefined): number | null {
  const cleaned = (input ?? '').replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned) * 100);
}

export const centsToInput = (cents: number | null | undefined): string => (cents == null ? '' : (cents / 100).toFixed(2));

export const dateTime = (iso: string | null | undefined): string =>
  iso ? formatInTimeZone(new Date(iso), TIME_ZONE, "MMM d, yyyy 'at' h:mm a") : '—';

/** A calendar date (yyyy-mm-dd) shown as written; no time zone shifting. */
export const dateOnly = (value: string | null | undefined): string => {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
};

export const ago = (iso: string | null | undefined): string =>
  iso ? `${formatDistanceToNowStrict(new Date(iso))} ago` : 'Never';

/** Today's date in Vancouver, as yyyy-mm-dd. */
export const vancouverToday = (): string => formatInTimeZone(new Date(), TIME_ZONE, 'yyyy-MM-dd');

/** Whole days from Vancouver-today to a calendar date (negative = past). */
export function daysUntil(date: string): number {
  const today = vancouverToday();
  const toUtc = (value: string) => {
    const [y, m, d] = value.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((toUtc(date) - toUtc(today)) / 86_400_000);
}
