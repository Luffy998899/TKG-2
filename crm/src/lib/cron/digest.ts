import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { OutboxConsumer, OutboxEvent } from '@/lib/outbox/types';

/* =============================================================================
   THE DAILY JOB (Vercel Cron -> /api/cron/digest, 08:00 America/Vancouver).
   One of the three allow-listed service-role uses.

     1. run the contract expiry engine (pg_cron already did at 07:00; this is
        a defensive, idempotent re-run so the digest never misses today)
     2. remove the stored bytes of rejected uploads
     3. the `email_digest` outbox consumer: one email per rep per day, listing
        their expiry milestones and overdue follow-ups, and one to admins for
        unassigned expiries. Bodies carry customer NAMES and DAYS only - no
        phone, email, address, pricing or task text.

   "At most one email per rep per day" is a database fact: a digest_sends row
   with UNIQUE (user_id, digest_date, kind) is inserted BEFORE sending, and
   only the request that inserted it sends. Resend also gets an
   Idempotency-Key, in case a send is retried.
   ========================================================================== */

export const DIGEST_CONSUMER = 'email_digest';

export function authorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  const given = request.headers.get('authorization') ?? '';
  if (secret.length < 32) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Vancouver wall-clock hour and date for an instant. */
export function vancouver(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { hour: Number(parts.hour), date: `${parts.year}-${parts.month}-${parts.day}` };
}

type Sender = (message: { to: string; subject: string; text: string; html: string; idempotencyKey: string }) => Promise<{ id?: string }>;

async function resendSender(message: Parameters<Sender>[0]): Promise<{ id?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': message.idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM_EMAIL || 'TKG CRM <crm@tkgventuresltd.ca>',
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}`);
  return (await response.json().catch(() => ({}))) as { id?: string };
}

interface Line {
  customerId: string;
  dealId: string;
  name: string;
  detail: string;
  sortKey: number;
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function renderDigest(title: string, sections: { heading: string; lines: Line[] }[], appUrl: string) {
  const filled = sections.filter((s) => s.lines.length);
  const text = [
    title,
    '',
    ...filled.flatMap((s) => [s.heading, ...s.lines.map((l) => `- ${l.name}: ${l.detail}  ${appUrl}/customers/${l.customerId}?deal=${l.dealId}`), '']),
    `Open the CRM: ${appUrl}/tasks`,
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1c1a17">
<h2 style="font-size:18px">${escape(title)}</h2>
${filled
  .map(
    (s) => `<h3 style="font-size:15px;margin:18px 0 6px">${escape(s.heading)}</h3><ul style="padding-left:18px;margin:0">${s.lines
      .map((l) => `<li style="margin:4px 0"><a href="${appUrl}/customers/${l.customerId}?deal=${l.dealId}">${escape(l.name)}</a>: ${escape(l.detail)}</li>`)
      .join('')}</ul>`,
  )
  .join('')}
<p style="margin-top:20px"><a href="${appUrl}/tasks">Open your tasks in TKG CRM</a></p></div>`;
  return { text, html };
}

export interface DailyResult {
  date: string;
  engineCreated: number;
  removedObjects: number;
  claimed: number;
  sent: number;
  skippedAlreadySent: number;
  failed: number;
}

/**
 * The whole daily run for `date` (Vancouver yyyy-mm-dd). `send` is injectable
 * for tests; production uses Resend.
 */
export async function runDaily(date: string, send: Sender = resendSender): Promise<DailyResult> {
  const service = createServiceRoleClient();
  const appUrl = (process.env.APP_URL ?? '').replace(/\/+$/, '');
  const result: DailyResult = { date, engineCreated: 0, removedObjects: 0, claimed: 0, sent: 0, skippedAlreadySent: 0, failed: 0 };

  const engine = await service.rpc('run_expiry_engine', { p_today: date });
  result.engineCreated = (engine.data as number | null) ?? 0;

  // Bytes of rejected uploads are never served; remove them.
  const rejected = await service.from('documents').select('storage_path').eq('status', 'rejected').limit(500);
  const paths = (rejected.data ?? []).map((row) => row.storage_path as string);
  if (paths.length) {
    const removed = await service.storage.from('crm-documents').remove(paths);
    result.removedObjects = removed.data?.length ?? 0;
  }

  const consumer = emailDigestConsumer(date, appUrl, send, result);
  const claimed = await service.rpc('claim_events', { p_consumer: consumer.name, p_types: consumer.handles, p_limit: 2000 });
  const events = (claimed.data ?? []) as OutboxEvent[];
  result.claimed = events.length;
  const outcome = await consumer.handle(events);
  await service.rpc('complete_events', { p_consumer: consumer.name, p_done: outcome.done, p_failed: outcome.failed });
  return result;
}

function emailDigestConsumer(date: string, appUrl: string, send: Sender, result: DailyResult): OutboxConsumer {
  return {
    name: DIGEST_CONSUMER,
    handles: ['contract.expiry_milestone'],
    async handle(events) {
      const service = createServiceRoleClient();
      const milestones = events.filter(
        (event): event is OutboxEvent<'contract.expiry_milestone'> => event.type === 'contract.expiry_milestone' && (event.payload as { for_date: string }).for_date <= date,
      );

      const [{ data: staff }, { data: overdue }] = await Promise.all([
        service.from('profiles').select('id, email, full_name, role, active').eq('active', true),
        service
          .from('tasks')
          .select('id, deal_id, customer_id, type, due_date, assigned_to, milestone, contracts(end_date)')
          .eq('status', 'open')
          .is('deleted_at', null)
          .is('superseded_at', null)
          .lt('due_date', date)
          .limit(5000),
      ]);
      const people = new Map((staff ?? []).map((p) => [p.id as string, p as { id: string; email: string; full_name: string; role: string }]));
      const customerIds = [...new Set([...milestones.map((m) => m.payload.customer_id), ...(overdue ?? []).map((t) => t.customer_id as string)])];
      const { data: customers } = customerIds.length
        ? await service.from('customers').select('id, full_name').in('id', customerIds)
        : { data: [] as { id: string; full_name: string }[] };
      const nameOf = new Map((customers ?? []).map((c) => [c.id as string, c.full_name as string]));

      const days = (target: string) => Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
      const repMilestones = new Map<string, Line[]>();
      const unassigned: Line[] = [];
      for (const event of milestones) {
        const left = days(event.payload.end_date);
        const line: Line = {
          customerId: event.payload.customer_id,
          dealId: event.payload.deal_id,
          name: nameOf.get(event.payload.customer_id) ?? 'Customer',
          detail: `contract ends in ${left} day${left === 1 ? '' : 's'} (${event.payload.milestone}-day reminder)`,
          sortKey: left,
        };
        if (event.payload.unassigned) unassigned.push(line);
        else repMilestones.set(event.payload.assigned_to, [...(repMilestones.get(event.payload.assigned_to) ?? []), line]);
      }
      const repOverdue = new Map<string, Line[]>();
      for (const task of overdue ?? []) {
        const late = -days(task.due_date as string);
        const end = (task.contracts as { end_date?: string } | null)?.end_date;
        const line: Line = {
          customerId: task.customer_id as string,
          dealId: task.deal_id as string,
          name: nameOf.get(task.customer_id as string) ?? 'Customer',
          detail:
            task.type === 'contract_expiry' && end
              ? `renewal reminder overdue by ${late} day${late === 1 ? '' : 's'} (contract ends in ${days(end)} days)`
              : `follow-up overdue by ${late} day${late === 1 ? '' : 's'}`,
          sortKey: -late,
        };
        repOverdue.set(task.assigned_to as string, [...(repOverdue.get(task.assigned_to as string) ?? []), line]);
      }

      const deliver = async (userId: string, kind: 'rep' | 'admin_unassigned', title: string, sections: { heading: string; lines: Line[] }[]) => {
        const person = people.get(userId);
        const count = sections.reduce((sum, s) => sum + s.lines.length, 0);
        if (!person || !count) return true;
        // Claim today's digest for this person BEFORE sending: only one claim can win.
        const claim = await service
          .from('digest_sends')
          .upsert({ user_id: userId, digest_date: date, kind, status: 'sending', item_count: count }, { onConflict: 'user_id,digest_date,kind', ignoreDuplicates: true })
          .select('id');
        if (!claim.data?.length) {
          result.skippedAlreadySent += 1;
          return true;
        }
        for (const section of sections) section.lines.sort((a, b) => a.sortKey - b.sortKey);
        const { text, html } = renderDigest(title, sections, appUrl);
        try {
          const sent = await send({ to: person.email, subject: title, text, html, idempotencyKey: `digest-${userId}-${date}-${kind}` });
          await service.from('digest_sends').update({ status: 'sent', resend_id: sent.id ?? null }).eq('id', claim.data[0]!.id);
          result.sent += 1;
          return true;
        } catch (error) {
          await service.from('digest_sends').update({ status: 'failed' }).eq('id', claim.data[0]!.id);
          console.error('[digest] send failed', userId, error instanceof Error ? error.message : error);
          result.failed += 1;
          return false;
        }
      };

      const failedUsers = new Set<string>();
      const recipients = new Set([...repMilestones.keys(), ...repOverdue.keys()]);
      for (const userId of recipients) {
        const ok = await deliver(userId, 'rep', `TKG CRM: your follow-ups for ${date}`, [
          { heading: 'Contract expiry reminders due today', lines: repMilestones.get(userId) ?? [] },
          { heading: 'Overdue', lines: repOverdue.get(userId) ?? [] },
        ]);
        if (!ok) failedUsers.add(userId);
      }
      let adminsOk = true;
      if (unassigned.length) {
        for (const admin of [...people.values()].filter((p) => p.role === 'admin')) {
          const ok = await deliver(admin.id, 'admin_unassigned', `TKG CRM: unassigned contract expiries for ${date}`, [
            { heading: 'Expiring contracts with no active rep', lines: unassigned },
          ]);
          adminsOk &&= ok;
        }
      }

      const done: number[] = [];
      const failed: { id: number; error: string }[] = [];
      for (const event of events) {
        const payload = event.payload as { assigned_to?: string; unassigned?: boolean };
        const bad = payload.unassigned ? !adminsOk : failedUsers.has(payload.assigned_to ?? '');
        if (bad) failed.push({ id: event.id, error: 'email not sent' });
        else done.push(event.id);
      }
      return { done, failed };
    },
  };
}
