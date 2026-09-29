'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useHydrated } from '@/lib/forms/use-hydrated';

export interface MonthPoint {
  label: string;
  leads: number;
  sales: number;
  cancellations: number;
}

/**
 * Monthly performance (requirement 8). Rendered only after hydration: the
 * chart library's server output uses inline style attributes, which the
 * production CSP (styles by nonce only) would block. On the client it sets
 * styles through the CSSOM, which the CSP allows.
 */
export function PerformanceChart({ data }: { data: MonthPoint[] }) {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="h-64 animate-none rounded-xl bg-paper-sunk" aria-hidden />;
  return (
    <div className="h-64" role="img" aria-label={`Leads, sales and cancellations for the last ${data.length} months`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfdad1" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6f6960' }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6f6960' }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: '#efece5' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="leads" name="Leads" fill="#1f5ca8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="sales" name="Sales" fill="#166f4e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="cancellations" name="Cancelled" fill="#a32f2a" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
