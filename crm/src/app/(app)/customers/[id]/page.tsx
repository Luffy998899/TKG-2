import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  ArrowRightLeft, CalendarCheck, FileText, Mail, MapPin, MessageCircle, NotebookPen, Phone,
  PhoneCall, Sparkles, UserRoundCheck, Footprints, type LucideIcon,
} from 'lucide-react';
import { requireStaff } from '@/lib/auth/current';
import { getCustomerProfile } from '@/lib/customers/queries';
import { listPipelines, listStaff, listStages } from '@/lib/deals/queries';
import { ago, dateTime, money } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { PipelineChip, StageChip } from '@/components/ui/chips';
import { DealControls } from '@/components/customers/deal-panel';
import { DocumentsPanel } from '@/components/customers/documents-panel';
import { QuickLog } from '@/components/customers/quick-log';
import { CustomerEdit } from '@/components/customers/customer-edit';
import { ContractsPanel } from '@/components/customers/contracts-panel';
import { TasksPanel } from '@/components/customers/tasks-panel';
import { getDealContracts, getDealTasks } from '@/lib/contracts/queries';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Customer' };

const ICON: Record<string, LucideIcon> = {
  call: PhoneCall, whatsapp: MessageCircle, email: Mail, visit: Footprints, note: NotebookPen,
  stage_change: ArrowRightLeft, assignment: UserRoundCheck, pipeline_move: ArrowRightLeft,
  document: FileText, contract: CalendarCheck, lead_created: Sparkles,
};
const LABEL: Record<string, string> = {
  call: 'Call', whatsapp: 'WhatsApp', email: 'Email', visit: 'Visit', note: 'Note', stage_change: 'Stage',
  assignment: 'Assignment', pipeline_move: 'Pipeline', document: 'Document', contract: 'Contract', lead_created: 'Lead',
};

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ deal?: string }>;
}) {
  const who = await requireStaff();
  const { id } = await params;
  const { deal: dealParam } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const profile = await getCustomerProfile(id);
  // RLS: a customer the caller may not see simply does not exist for them.
  if (!profile) notFound();
  const { customer, deals, dealDetails, activities, documents, names } = profile;

  const selected = deals.find((d) => d.deal_id === dealParam) ?? deals[0];
  const detail = dealDetails.find((d) => d.id === selected?.deal_id);
  const [stages, pipelines, staff, contracts, tasks] = await Promise.all([
    listStages(),
    who.is_admin ? listPipelines() : Promise.resolve([]),
    who.is_admin ? listStaff() : Promise.resolve([]),
    selected ? getDealContracts(selected.deal_id) : Promise.resolve([]),
    selected ? getDealTasks(selected.deal_id) : Promise.resolve([]),
  ]);

  const lastContacted = deals
    .map((d) => d.last_contacted_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);
  const phone = formatPhone(customer.phone_e164, customer.phone_raw);
  const waDigits = (customer.phone_e164 ?? '').replace(/\D/g, '');

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="min-w-0 space-y-5">
        {/* ------------------------------------------------ contact */}
        <section className="rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{customer.full_name}</h1>
          <p className={cn('mt-1 text-sm font-semibold', lastContacted ? 'text-ink' : 'text-danger')}>
            Last contacted: {ago(lastContacted)}
          </p>
          <dl className="mt-3 space-y-1 text-sm text-ink-soft">
            {phone ? <div className="flex gap-2"><dt className="sr-only">Phone</dt><Phone aria-hidden className="mt-0.5 h-4 w-4" /><dd>{phone}</dd></div> : null}
            {customer.email ? <div className="flex gap-2"><dt className="sr-only">Email</dt><Mail aria-hidden className="mt-0.5 h-4 w-4" /><dd className="break-all">{customer.email}</dd></div> : null}
            {customer.address || customer.city ? (
              <div className="flex gap-2"><dt className="sr-only">Address</dt><MapPin aria-hidden className="mt-0.5 h-4 w-4" /><dd>{[customer.address, customer.city].filter(Boolean).join(', ')}</dd></div>
            ) : null}
          </dl>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <a
              href={customer.phone_e164 ? `tel:${customer.phone_e164}` : undefined}
              aria-disabled={!customer.phone_e164}
              className={cn('flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-ink text-sm font-semibold text-paper-raised', !customer.phone_e164 && 'pointer-events-none opacity-40')}
            >
              <PhoneCall aria-hidden className="h-5 w-5" />Call
            </a>
            <a
              href={waDigits ? `https://wa.me/${waDigits}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!waDigits}
              className={cn('flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-ok text-sm font-semibold text-white', !waDigits && 'pointer-events-none opacity-40')}
            >
              <MessageCircle aria-hidden className="h-5 w-5" />WhatsApp
            </a>
            <a
              href={customer.email ? `mailto:${customer.email}` : undefined}
              aria-disabled={!customer.email}
              className={cn('flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-line-strong text-sm font-semibold', !customer.email && 'pointer-events-none opacity-40')}
            >
              <Mail aria-hidden className="h-5 w-5" />Email
            </a>
          </div>
        </section>

        {/* -------------------------------------------------- deals */}
        {deals.length > 1 ? (
          <nav aria-label="Deals" className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {deals.map((deal) => (
              <Link
                key={deal.deal_id}
                href={`/customers/${customer.id}?deal=${deal.deal_id}`}
                aria-current={deal.deal_id === selected?.deal_id ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold',
                  deal.deal_id === selected?.deal_id ? 'border-ink bg-paper-raised' : 'border-line bg-paper-sunk',
                )}
              >
                {deal.pipeline_name} · {deal.stage_name}
              </Link>
            ))}
          </nav>
        ) : null}

        {selected && detail ? (
          <section className="space-y-4 rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <PipelineChip slug={selected.pipeline_slug} name={selected.pipeline_name} />
              <StageChip stageKey={selected.stage_key} name={selected.stage_name} />
              <span className="text-xs text-ink-mute">
                {selected.assigned_name ? `Rep: ${selected.assigned_name}` : 'Unassigned'} · {detail.source === 'web' ? 'Website' : detail.source === 'direct_add' ? 'Existing client' : detail.source === 'import' ? 'Imported' : 'Manual'}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-ink-mute">One-time</dt><dd className="font-semibold">{money(detail.one_time_price_cents)}</dd></div>
              <div><dt className="text-ink-mute">Monthly</dt><dd className="font-semibold">{money(detail.monthly_price_cents)}</dd></div>
              <div><dt className="text-ink-mute">Term</dt><dd className="font-semibold">{detail.term_months ? `${detail.term_months} mo` : '—'}</dd></div>
              <div><dt className="text-ink-mute">Installation</dt><dd className="font-semibold">{detail.installation_date ?? '—'}</dd></div>
            </dl>
            {selected.stage_key === 'cancelled' && detail.cancel_reason ? (
              <p className="rounded-xl bg-danger/5 p-3 text-sm text-danger">Cancelled: {detail.cancel_reason}</p>
            ) : null}
            <DealControls
              key={`${detail.id}-${selected.stage_key}-${detail.assigned_to}-${detail.pipeline_id}`}
              deal={detail}
              stageKey={selected.stage_key}
              stageName={selected.stage_name}
              stages={stages}
              isAdmin={who.is_admin}
              pipelines={pipelines.map((p) => ({ value: p.id, label: p.name }))}
              reps={staff.map((s) => ({ value: s.id, label: `${s.full_name}${s.role === 'admin' ? ' (admin)' : ''}` }))}
            />
          </section>
        ) : null}

        {selected ? (
          <>
            <section className="space-y-3 rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
              <h2 className="font-display text-lg font-semibold">Contract</h2>
              <ContractsPanel dealId={selected.deal_id} contracts={contracts} isAdmin={who.is_admin} />
            </section>
            <section className="space-y-3 rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
              <h2 className="font-display text-lg font-semibold">Follow-ups</h2>
              <TasksPanel dealId={selected.deal_id} tasks={tasks} />
            </section>
            <section className="space-y-3 rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
              <h2 className="font-display text-lg font-semibold">Documents</h2>
              <DocumentsPanel dealId={selected.deal_id} documents={documents.filter((d) => d.deal_id === selected.deal_id)} />
            </section>
          </>
        ) : null}

        <details className="rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
          <summary className="min-h-12 cursor-pointer py-2 font-display text-lg font-semibold">Edit customer details</summary>
          <div className="mt-3">
            <CustomerEdit customer={customer} isAdmin={who.is_admin} />
          </div>
        </details>
      </div>

      {/* ------------------------------------------------- timeline */}
      <aside className="min-w-0 space-y-4">
        {selected ? (
          <section className="rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
            <QuickLog dealId={selected.deal_id} />
          </section>
        ) : null}
        <section className="rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Timeline</h2>
          {activities.length ? (
            <ol className="space-y-3">
              {activities.map((activity) => {
                const Icon = ICON[activity.type] ?? NotebookPen;
                return (
                  <li key={activity.id} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-sunk text-ink-soft">
                      <Icon aria-hidden className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 border-b border-line pb-3">
                      <p className="text-sm">
                        <span className="font-semibold">{LABEL[activity.type] ?? activity.type}</span>
                        {activity.body ? <span className="text-ink-soft"> — {activity.body}</span> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-mute">
                        {dateTime(activity.occurred_at)} · {activity.actor_id ? names.get(activity.actor_id) ?? 'Staff' : 'System'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-ink-soft">Nothing yet.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
