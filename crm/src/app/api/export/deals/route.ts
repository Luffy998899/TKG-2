import { getWhoami } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { parseFilters } from '@/lib/deals/filters';
import { listDeals } from '@/lib/deals/queries';
import { requestMeta } from '@/lib/request-meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Spreadsheet formula injection: a cell starting with = + - @ tab or CR is made text. */
function cell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Admin-only CSV of the current search. Runs as the admin (RLS applies), is
 * capped, and every export is written to the audit log with its filters and
 * row count.
 */
export async function GET(request: Request) {
  const who = await getWhoami();
  if (!who?.active || !who.is_admin) return new Response('Not found', { status: 404 });

  const url = new URL(request.url);
  const filters = parseFilters(Object.fromEntries(url.searchParams));
  const rows = await listDeals(filters, 5000);

  const header = ['Customer', 'Phone', 'Email', 'Address', 'City', 'Pipeline', 'Stage', 'Rep', 'Service', 'Monthly (CAD)', 'One-time (CAD)', 'Contract end', 'Last contacted', 'Created'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.customer_name, row.phone_e164 ?? row.phone_raw, row.email, row.address, row.city, row.pipeline_name, row.stage_name,
        row.assigned_name ?? 'Unassigned', row.service,
        row.monthly_price_cents == null ? '' : (row.monthly_price_cents / 100).toFixed(2),
        row.one_time_price_cents == null ? '' : (row.one_time_price_cents / 100).toFixed(2),
        row.contract_end_date, row.last_contacted_at, row.created_at,
      ].map(cell).join(','),
    );
  }

  const meta = await requestMeta();
  const supabase = await createClient();
  await supabase.rpc('log_audit_event', {
    p_action: 'export.csv',
    p_entity_type: 'deals',
    p_entity_id: null,
    p_metadata: { rows: rows.length, filters },
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tkg-crm-deals-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
