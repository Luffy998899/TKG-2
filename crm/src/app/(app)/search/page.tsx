import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { requireStaff } from '@/lib/auth/current';
import { parseFilters, toQueryString } from '@/lib/deals/filters';
import { listDeals, listPipelines, listStaff, listStages } from '@/lib/deals/queries';
import { PageHeader } from '@/components/app-shell/page-header';
import { DealCard } from '@/components/deals/deal-card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';

export const metadata: Metadata = { title: 'Search' };

/** Name, phone (any format), address, rep, pipeline, stage and contract-expiry range (requirement 9). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const who = await requireStaff();
  const filters = parseFilters(await searchParams);
  const searched = Object.values(filters).some(Boolean);
  const [stages, pipelines, staff, results] = await Promise.all([
    listStages(),
    listPipelines(),
    who.is_admin ? listStaff() : Promise.resolve([]),
    searched ? listDeals(filters, 200) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Search" />
      {/* A plain GET form: works before JavaScript, and the URL is the search. */}
      <form method="get" role="search" className="grid gap-3 rounded-2xl border border-line bg-paper-raised p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Label htmlFor="q">Name, phone, email or address</Label>
          <Input id="q" name="q" defaultValue={filters.q ?? ''} inputMode="search" enterKeyHint="search" placeholder="e.g. 604 555 0199 or Smith" />
        </div>
        <div>
          <Label htmlFor="pipeline">Pipeline / service</Label>
          <Select id="pipeline" name="pipeline" defaultValue={filters.pipeline ?? ''}>
            <option value="">Any</option>
            {pipelines.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="stage">Stage</Label>
          <Select id="stage" name="stage" defaultValue={filters.stage ?? ''}>
            <option value="">Any</option>
            {stages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </Select>
        </div>
        {who.is_admin ? (
          <div>
            <Label htmlFor="rep">Rep</Label>
            <Select id="rep" name="rep" defaultValue={filters.rep ?? ''}>
              <option value="">Any</option>
              <option value="unassigned">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </Select>
          </div>
        ) : null}
        <div>
          <Label htmlFor="expires_from">Contract ends after</Label>
          <Input id="expires_from" name="expires_from" type="date" defaultValue={filters.expires_from ?? ''} />
        </div>
        <div>
          <Label htmlFor="expires_to">Contract ends before</Label>
          <Input id="expires_to" name="expires_to" type="date" defaultValue={filters.expires_to ?? ''} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" className="flex-1">Search</Button>
          {who.is_admin && searched ? (
            <a
              href={`/api/export/deals${toQueryString(filters as Record<string, string | undefined>)}`}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-semibold hover:bg-paper-sunk"
            >
              <Download aria-hidden className="h-4 w-4" />
              CSV
            </a>
          ) : null}
        </div>
      </form>

      {searched ? (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold text-ink-soft">{results.length}{results.length === 200 ? '+' : ''} result{results.length === 1 ? '' : 's'}</h2>
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {results.map((deal) => (
              <li key={deal.deal_id}><DealCard deal={deal} showRep={who.is_admin} /></li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
