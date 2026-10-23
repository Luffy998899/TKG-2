'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { bulkAssignAction } from '@/lib/deals/actions';
import type { DealRow, Staff } from '@/lib/deals/queries';
import { Button } from '@/components/ui/button';
import { FormNotice, Input, Label, Select } from '@/components/ui/field';

export function BulkAssignment({ deals, staff }: { deals: DealRow[]; staff: Staff[] }) {
  const router = useRouter();
  const reps = staff.filter((rep) => rep.active && rep.role === 'sales_rep');
  const [selected, setSelected] = useState<string[]>([]);
  const [repId, setRepId] = useState('');
  const [distribution, setDistribution] = useState(false);
  const [repIds, setRepIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState('98');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const unassigned = deals.filter((d) => !d.assigned_to);
  const chosenReps = distribution ? repIds : repId ? [repId] : [];
  const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
  const validQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0 && Number(quantity) <= unassigned.length;
  const selectedRows = deals.filter((deal) => selected.includes(deal.deal_id));

  return (
    <details className="mt-4 rounded-2xl border border-line bg-paper-raised p-4">
      <summary className="min-h-12 cursor-pointer py-3 font-semibold">Bulk assignment · {unassigned.length} unassigned in these results</summary>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Select leads below, then assign them together. Only the assigned rep changes; customer details, stages and existing history stay the same.</p>
        {deals.length >= 300 ? <FormNotice tone="info">Showing up to 300 leads. Filter by pipeline or rep to narrow the selection.</FormNotice> : null}
        <fieldset disabled={pending} className="space-y-3">
          <legend className="sr-only">Select leads and sales reps</legend>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSelected(deals.map((d) => d.deal_id))}>Select all results ({deals.length})</Button>
            <Button type="button" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
            <div>
              <Label htmlFor="bulk-count">Number of unassigned leads</Label>
              <Input id="bulk-count" type="number" min={1} max={unassigned.length} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-28" />
            </div>
            <Button type="button" variant="secondary" disabled={!validQuantity} onClick={() => setSelected(unassigned.slice(0, Number(quantity)).map((d) => d.deal_id))}>Select first {quantity || '…'} unassigned</Button>
          </div>
          <label className="flex min-h-12 items-center gap-3 text-sm font-semibold">
            <input type="checkbox" checked={distribution} onChange={(event) => setDistribution(event.target.checked)} />
            Distribute selected leads equally between reps
          </label>
          {distribution ? (
            <div className="flex flex-wrap gap-3">
              {reps.map((rep) => <label key={rep.id} className="flex min-h-12 items-center gap-2 text-sm"><input type="checkbox" checked={repIds.includes(rep.id)} onChange={() => setRepIds(toggle(repIds, rep.id))} />{rep.full_name}</label>)}
            </div>
          ) : (
            <div>
              <Label htmlFor="bulk-rep">Assign to sales rep</Label>
              <Select id="bulk-rep" value={repId} onChange={(event) => setRepId(event.target.value)}>
                <option value="">Choose a rep</option>
                {reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.full_name}</option>)}
              </Select>
            </div>
          )}
          <div className="max-h-80 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead><tr><th className="p-3">Select</th><th>Customer</th><th>Pipeline / stage</th><th>Assigned rep</th></tr></thead>
              <tbody>{deals.map((deal) => <tr key={deal.deal_id} className="border-t border-line">
                <td className="p-1"><label className="inline-flex h-12 w-12 items-center justify-center"><input type="checkbox" aria-label={`Select ${deal.customer_name}`} checked={selected.includes(deal.deal_id)} onChange={() => setSelected(toggle(selected, deal.deal_id))} className="h-5 w-5" /></label></td>
                <td className="pr-3">{deal.customer_name}</td><td className="pr-3">{deal.pipeline_name} · {deal.stage_name}</td><td>{deal.assigned_name ?? 'Unassigned'}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {selected.length && chosenReps.length ? <p className="text-sm" role="status">
            {selected.length} leads selected. {chosenReps.map((id, index) => `${reps.find((r) => r.id === id)?.full_name}: ${Math.floor(selected.length / chosenReps.length) + (index < selected.length % chosenReps.length ? 1 : 0)}`).join(' · ')}.
            {' '}{unassigned.length - selectedRows.filter((d) => !d.assigned_to).length} of these unassigned leads will remain unassigned.
          </p> : null}
          <Button type="button" disabled={!selected.length || !chosenReps.length || pending} onClick={() => startTransition(async () => {
            setNotice(null);
            const result = await bulkAssignAction({ leads: selectedRows.map((d) => ({ deal_id: d.deal_id, assigned_to: d.assigned_to })), repIds: chosenReps });
            setNotice({ ok: result.ok, text: result.ok ? `${result.updated} leads assigned successfully.` : result.error });
            if (result.ok) { setSelected([]); router.refresh(); }
          })}>{pending ? 'Assigning…' : distribution ? `Distribute ${selected.length} leads equally` : `Assign ${selected.length} leads`}</Button>
        </fieldset>
        {notice ? <FormNotice tone={notice.ok ? 'ok' : 'error'}>{notice.text}</FormNotice> : null}
      </div>
    </details>
  );
}
