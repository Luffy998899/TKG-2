'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormNotice, Label, Select } from '@/components/ui/field';
import { IMPORT_FIELDS, MAX_IMPORT_ROWS, guessMapping, type DateFormat, type Mapping } from '@/lib/import/normalize';
import { appendRowsAction, commitImportAction, createImportAction, validateImportAction, type ValidationSummary } from '@/lib/import/actions';
import { cn } from '@/lib/utils';

const MAX_FILE = 5 * 1024 * 1024;
const CHUNK = 500;

interface PreviewRow {
  row_number: number;
  errors: string[];
  action: string | null;
  normalized: { full_name?: string; phone_e164?: string | null; email?: string } | null;
}

export function ImportWizard({
  pipelines,
  stages,
  loadPreview,
}: {
  pipelines: { id: string; name: string }[];
  stages: { key: string; name: string }[];
  loadPreview: (batchId: string) => Promise<PreviewRow[]>;
}) {
  const [file, setFile] = useState<{ name: string; headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [dateFormat, setDateFormat] = useState<DateFormat>('YYYY-MM-DD');
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? '');
  const [stageKey, setStageKey] = useState('completed');
  const [policy, setPolicy] = useState<'attach' | 'skip'>('attach');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (chosen: File) => {
    setError(null);
    setDone(null);
    setSummary(null);
    setBatchId(null);
    if (chosen.size > MAX_FILE) return setError('That file is over 5 MB. Split it into smaller files.');
    Papa.parse<Record<string, string>>(chosen, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        const headers = (result.meta.fields ?? []).filter(Boolean);
        if (!headers.length) return setError('No header row found. The first row must name the columns.');
        if (result.data.length > MAX_IMPORT_ROWS) return setError(`At most ${MAX_IMPORT_ROWS} rows per import.`);
        setFile({ name: chosen.name, headers, rows: result.data });
        setMapping(guessMapping(headers));
      },
      error: () => setError('That file could not be read as CSV.'),
    });
  };

  const dryRun = () =>
    startTransition(async () => {
      if (!file) return;
      setError(null);
      setProgress('Starting…');
      const created = await createImportAction({
        filename: file.name,
        totalRows: file.rows.length,
        mapping: Object.fromEntries(Object.entries(mapping).filter(([, column]) => Boolean(column))) as Record<string, string>,
        dateFormat,
        defaultPipelineId: pipelineId,
        defaultStageKey: stageKey,
        duplicatePolicy: policy,
      });
      if (!created.ok) return (setError(created.error), setProgress(null));
      for (let start = 0; start < file.rows.length; start += CHUNK) {
        setProgress(`Staging rows ${start + 1}–${Math.min(start + CHUNK, file.rows.length)} of ${file.rows.length}…`);
        const chunk = file.rows.slice(start, start + CHUNK).map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v ?? '')])));
        const appended = await appendRowsAction({ batchId: created.batchId, startRow: start + 1, rows: chunk });
        if (!appended.ok) return (setError(appended.error), setProgress(null));
      }
      setProgress('Checking every row (dry run)…');
      const validated = await validateImportAction(created.batchId);
      setProgress(null);
      if (!validated.ok) return setError(validated.error);
      setBatchId(created.batchId);
      setSummary(validated.summary);
      setPreview(await loadPreview(created.batchId));
    });

  const commit = () =>
    startTransition(async () => {
      if (!batchId) return;
      const result = await commitImportAction(batchId);
      if (!result.ok) return setError(result.error);
      setDone(`Imported ${result.deals} deal${result.deals === 1 ? '' : 's'}: ${result.created} new customer${result.created === 1 ? '' : 's'}, ${result.attached} added to existing customers, ${result.skipped} row${result.skipped === 1 ? '' : 's'} skipped.`);
      setSummary(null);
      setFile(null);
    });

  if (done) {
    return (
      <div className="space-y-3">
        <FormNotice tone="ok">{done}</FormNotice>
        <div className="flex gap-2">
          <Button asChild variant="secondary"><Link href="/leads?stage=all">View leads</Link></Button>
          <Button variant="ghost" onClick={() => setDone(null)}>Import another file</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-paper-raised p-6 text-center hover:bg-paper-sunk">
        <FileSpreadsheet aria-hidden className="h-6 w-6 text-ink-mute" />
        <span className="text-sm font-semibold">{file ? `${file.name} · ${file.rows.length} rows` : 'Choose a CSV file (first row = column names)'}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => event.target.files?.[0] && pick(event.target.files[0])} />
      </label>

      {file ? (
        <>
          <section className="space-y-3 rounded-2xl border border-line bg-paper-raised p-4">
            <h2 className="font-display text-lg font-semibold">1. Match the columns</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {IMPORT_FIELDS.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`map-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
                  <Select id={`map-${field.key}`} value={mapping[field.key] ?? ''} onChange={(event) => setMapping((m) => ({ ...m, [field.key]: event.target.value || undefined }))}>
                    <option value="">— not in file —</option>
                    {file.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </Select>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 rounded-2xl border border-line bg-paper-raised p-4 sm:grid-cols-2 lg:grid-cols-4">
            <h2 className="font-display text-lg font-semibold sm:col-span-2 lg:col-span-4">2. Defaults and rules</h2>
            <div>
              <Label htmlFor="date-format">Dates in the file are</Label>
              <Select id="date-format" value={dateFormat} onChange={(event) => setDateFormat(event.target.value as DateFormat)}>
                <option value="YYYY-MM-DD">2025-03-31 (YYYY-MM-DD)</option>
                <option value="MM/DD/YYYY">03/31/2025 (MM/DD/YYYY)</option>
                <option value="DD/MM/YYYY">31/03/2025 (DD/MM/YYYY)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="default-pipeline">Pipeline when not in the file</Label>
              <Select id="default-pipeline" value={pipelineId} onChange={(event) => setPipelineId(event.target.value)}>
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="default-stage">Stage when not in the file</Label>
              <Select id="default-stage" value={stageKey} onChange={(event) => setStageKey(event.target.value)}>
                {stages.filter((s) => s.key !== 'cancelled').map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="policy">If a customer already exists</Label>
              <Select id="policy" value={policy} onChange={(event) => setPolicy(event.target.value as 'attach' | 'skip')}>
                <option value="attach">Add the deal to them</option>
                <option value="skip">Skip the row</option>
              </Select>
            </div>
          </section>

          {progress ? <FormNotice tone="info">{progress}</FormNotice> : null}
          {error ? <FormNotice>{error}</FormNotice> : null}
          {!summary ? (
            <Button size="wide" onClick={dryRun} disabled={pending || !mapping.full_name}>3. Check the file (dry run, nothing imported yet)</Button>
          ) : null}
        </>
      ) : error ? <FormNotice>{error}</FormNotice> : null}

      {summary ? (
        <section className="space-y-4 rounded-2xl border border-line bg-paper-raised p-4">
          <h2 className="font-display text-lg font-semibold">Dry run result</h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['New customers', summary.create, ''],
              ['Added to existing', summary.attach, ''],
              ['Skipped duplicates', summary.skip, ''],
              ['Rows with errors', summary.errors, summary.errors ? 'text-danger' : ''],
            ].map(([label, value, tone]) => (
              <div key={label as string} className="rounded-xl bg-paper-sunk p-3">
                <dt className="text-xs text-ink-mute">{label}</dt>
                <dd className={cn('font-display text-2xl font-semibold', tone as string)}>{value}</dd>
              </div>
            ))}
          </dl>
          {preview.length ? (
            <div className="max-h-96 overflow-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-paper-sunk text-xs uppercase text-ink-mute">
                  <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Will</th><th className="px-3 py-2">Problems</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.map((row) => (
                    <tr key={row.row_number} className={row.errors.length ? 'bg-danger/5' : ''}>
                      <td className="px-3 py-2 tabular-nums">{row.row_number}</td>
                      <td className="px-3 py-2">{row.normalized?.full_name || '—'}<span className="block text-xs text-ink-mute">{row.normalized?.phone_e164 ?? row.normalized?.email}</span></td>
                      <td className="px-3 py-2">{row.errors.length ? 'skip' : row.action}</td>
                      <td className="px-3 py-2 text-danger">{row.errors.join(' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {error ? <FormNotice>{error}</FormNotice> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={commit} disabled={pending || summary.create + summary.attach === 0}>
              Import {summary.create + summary.attach} row{summary.create + summary.attach === 1 ? '' : 's'}
            </Button>
            <Button variant="ghost" onClick={() => setSummary(null)} disabled={pending}>Change the mapping</Button>
          </div>
          <p className="text-xs text-ink-mute">Rows with errors are never imported. The import is one transaction: all valid rows go in together, or none do.</p>
        </section>
      ) : null}
    </div>
  );
}
