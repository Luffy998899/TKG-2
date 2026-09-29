'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input, Select } from '@/components/ui/field';

interface Option {
  value: string;
  label: string;
}

/** Pipeline / rep / text filters, kept in the URL so views are shareable and survive reloads. */
export function LeadFilters({ pipelines, reps, keep = [] }: { pipelines: Option[]; reps?: Option[]; keep?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  const apply = (next: Record<string, string>) => {
    const query = new URLSearchParams();
    for (const key of ['pipeline', 'rep', 'q', ...keep]) {
      const value = key in next ? next[key] : params.get(key);
      if (value) query.set(key, value);
    }
    router.push(`${pathname}${query.size ? `?${query}` : ''}`);
  };

  return (
    <form
      role="search"
      className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]"
      onSubmit={(event) => {
        event.preventDefault();
        apply({ q });
      }}
    >
      <label className="relative block">
        <span className="sr-only">Search name, phone or address</span>
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Name, phone or address"
          className="pl-10"
          inputMode="search"
          enterKeyHint="search"
        />
      </label>
      <label>
        <span className="sr-only">Pipeline</span>
        <Select value={params.get('pipeline') ?? ''} onChange={(event) => apply({ pipeline: event.target.value })}>
          <option value="">All pipelines</option>
          {pipelines.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </label>
      {reps ? (
        <label>
          <span className="sr-only">Rep</span>
          <Select value={params.get('rep') ?? ''} onChange={(event) => apply({ rep: event.target.value })}>
            <option value="">All reps</option>
            <option value="unassigned">Unassigned</option>
            {reps.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>
      ) : null}
    </form>
  );
}
