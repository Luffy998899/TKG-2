'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormNotice, Input, Label, Select } from '@/components/ui/field';
import { renameStageAction, saveFallbackAction, savePipelineAction, saveRuleAction } from '@/lib/pipelines/actions';
import { centsToInput } from '@/lib/format';

type Result = { ok: true } | { ok: false; error: string };

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const run = (work: () => Promise<Result>, done = 'Saved.') =>
    startTransition(async () => {
      const result = await work();
      setMessage(result.ok ? { tone: 'ok', text: done } : { tone: 'error', text: result.error });
      if (result.ok) router.refresh();
    });
  return { pending, message, run };
}

export interface PipelineRow {
  id: string;
  slug: string;
  name: string;
  accent: string;
  accent_ink: string;
  accent_soft: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

export interface RuleRow {
  pipeline_id: string;
  type: 'flat' | 'percent';
  flat_amount_cents: number;
  percent_bps: number;
  value_basis: 'one_time' | 'monthly' | 'total_contract';
  is_active: boolean;
}

export function PipelineForm({ pipeline, rule }: { pipeline?: PipelineRow; rule?: RuleRow }) {
  const { pending, message, run } = useRun();
  const [v, setV] = useState({
    slug: pipeline?.slug ?? '',
    name: pipeline?.name ?? '',
    accent: pipeline?.accent ?? '#1F5CA8',
    accentInk: pipeline?.accent_ink ?? '#1B4C8A',
    accentSoft: pipeline?.accent_soft ?? '#E6EDF7',
    sortOrder: String(pipeline?.sort_order ?? 100),
    isActive: pipeline?.is_active ?? true,
  });
  const [r, setR] = useState({
    type: rule?.type ?? 'flat',
    flatAmount: centsToInput(rule?.flat_amount_cents ?? 0),
    percent: rule ? String(rule.percent_bps / 100) : '0',
    valueBasis: rule?.value_basis ?? 'total_contract',
    isActive: rule?.is_active ?? true,
  });
  const set = (key: keyof typeof v) => (event: React.ChangeEvent<HTMLInputElement>) => setV((c) => ({ ...c, [key]: event.target.value }));
  const id = pipeline?.id ?? 'new';

  return (
    <div className="space-y-4">
      <form
        method="post"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => savePipelineAction({ id: pipeline?.id ?? '', ...v, sortOrder: Number(v.sortOrder) }), pipeline ? 'Pipeline saved.' : 'Pipeline added.');
        }}
      >
        <div>
          <Label htmlFor={`name-${id}`}>Name</Label>
          <Input id={`name-${id}`} value={v.name} onChange={set('name')} maxLength={80} />
        </div>
        <div>
          <Label htmlFor={`slug-${id}`}>Slug</Label>
          <Input id={`slug-${id}`} value={v.slug} onChange={set('slug')} disabled={Boolean(pipeline)} maxLength={60} />
        </div>
        <div>
          <Label htmlFor={`order-${id}`}>Order</Label>
          <Input id={`order-${id}`} inputMode="numeric" value={v.sortOrder} onChange={set('sortOrder')} />
        </div>
        <label className="flex min-h-12 items-center gap-3 self-end">
          <input type="checkbox" className="h-5 w-5" checked={v.isActive} disabled={pipeline?.is_system} onChange={(event) => setV((c) => ({ ...c, isActive: event.target.checked }))} />
          <span className="text-sm font-semibold">Active</span>
        </label>
        {(['accent', 'accentInk', 'accentSoft'] as const).map((key) => (
          <div key={key}>
            <Label htmlFor={`${key}-${id}`}>{key === 'accent' ? 'Accent' : key === 'accentInk' ? 'Chip text' : 'Chip background'}</Label>
            <div className="flex gap-2">
              <input
                type="color"
                aria-label={`${key} picker`}
                value={v[key]}
                onChange={set(key)}
                className="h-12 w-12 shrink-0 cursor-pointer rounded-xl border border-line-strong bg-paper-raised"
              />
              <Input id={`${key}-${id}`} value={v[key]} onChange={set(key)} maxLength={7} className="font-mono" />
            </div>
          </div>
        ))}
        <div className="flex items-end">
          <Button type="submit" variant="secondary" size="wide" disabled={pending}>{pipeline ? 'Save pipeline' : 'Add pipeline'}</Button>
        </div>
      </form>

      {pipeline && pipeline.slug !== 'general' ? (
        <form
          method="post"
          className="grid gap-3 rounded-xl border border-line bg-paper-sunk/50 p-3 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => saveRuleAction({ pipelineId: pipeline.id, ...r }), 'Commission rule saved.');
          }}
        >
          <div>
            <Label htmlFor={`type-${id}`}>Commission</Label>
            <Select id={`type-${id}`} value={r.type} onChange={(event) => setR((c) => ({ ...c, type: event.target.value as 'flat' | 'percent' }))}>
              <option value="flat">Flat CAD amount</option>
              <option value="percent">% of deal value</option>
            </Select>
          </div>
          {r.type === 'flat' ? (
            <div>
              <Label htmlFor={`flat-${id}`}>Amount (CAD)</Label>
              <Input id={`flat-${id}`} inputMode="decimal" value={r.flatAmount} onChange={(event) => setR((c) => ({ ...c, flatAmount: event.target.value }))} />
            </div>
          ) : (
            <div>
              <Label htmlFor={`pct-${id}`}>Percent</Label>
              <Input id={`pct-${id}`} inputMode="decimal" value={r.percent} onChange={(event) => setR((c) => ({ ...c, percent: event.target.value }))} />
            </div>
          )}
          <div>
            <Label htmlFor={`basis-${id}`}>Deal value is</Label>
            <Select id={`basis-${id}`} value={r.valueBasis} onChange={(event) => setR((c) => ({ ...c, valueBasis: event.target.value as RuleRow['value_basis'] }))}>
              <option value="total_contract">One-time + monthly × term</option>
              <option value="one_time">One-time price</option>
              <option value="monthly">Monthly price</option>
            </Select>
          </div>
          <label className="flex min-h-12 items-center gap-3 self-end">
            <input type="checkbox" className="h-5 w-5" checked={r.isActive} onChange={(event) => setR((c) => ({ ...c, isActive: event.target.checked }))} />
            <span className="text-sm font-semibold">Rule on</span>
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="secondary" size="wide" disabled={pending}>Save rule</Button>
          </div>
        </form>
      ) : null}
      {message ? <FormNotice tone={message.tone}>{message.text}</FormNotice> : null}
    </div>
  );
}

export function StageNames({ stages }: { stages: { id: number; name: string }[] }) {
  const { pending, message, run } = useRun();
  const [names, setNames] = useState(Object.fromEntries(stages.map((s) => [s.id, s.name])));
  return (
    <div className="space-y-3">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage) => (
          <li key={stage.id} className="flex gap-2">
            <Input aria-label={`Stage ${stage.id} name`} value={names[stage.id]} maxLength={60} onChange={(event) => setNames((c) => ({ ...c, [stage.id]: event.target.value }))} />
            <Button
              variant="secondary"
              disabled={pending || names[stage.id] === stage.name}
              onClick={() => run(() => renameStageAction(stage.id, names[stage.id]), 'Stage renamed.')}
            >
              Save
            </Button>
          </li>
        ))}
      </ul>
      {message ? <FormNotice tone={message.tone}>{message.text}</FormNotice> : null}
    </div>
  );
}

export function FallbackPicker({ admins, current }: { admins: { id: string; full_name: string }[]; current: string | null }) {
  const { pending, message, run } = useRun();
  return (
    <div className="space-y-2">
      <Label htmlFor="fallback">Unassigned contract reminders go to</Label>
      <Select id="fallback" defaultValue={current ?? ''} disabled={pending} onChange={(event) => run(() => saveFallbackAction(event.target.value))}>
        <option value="">The first admin</option>
        {admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.full_name}</option>)}
      </Select>
      {message ? <FormNotice tone={message.tone}>{message.text}</FormNotice> : null}
    </div>
  );
}
