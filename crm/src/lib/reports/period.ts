import { vancouverToday } from '@/lib/format';

/** A calendar month, from ?month=YYYY-MM (default: this month in Vancouver). */
export function monthPeriod(value: string | undefined) {
  const current = vancouverToday().slice(0, 7);
  const month = value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : current;
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  return {
    month,
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
    label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    previous: shift(-1),
    next: month < current ? shift(1) : null,
  };
}
