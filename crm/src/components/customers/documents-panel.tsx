'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Eye, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormNotice, Label, Select } from '@/components/ui/field';
import { BASE_PATH } from '@/lib/base-path';
import type { DocumentRow } from '@/lib/customers/queries';

const MAX = 15 * 1024 * 1024;
const size = (bytes: number | null) => (bytes == null ? '' : bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Documents for one deal. A file is sent to the CRM, which checks its bytes
 * before it is listed. Opening one goes through the CRM too, which checks the
 * user may see it and records the view or download.
 */
export function DocumentsPanel({ dealId, documents }: { dealId: string; documents: DocumentRow[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState('other');
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const upload = (file: File) =>
    startTransition(async () => {
      setMessage(null);
      if (file.size > MAX) return setMessage({ tone: 'error', text: 'That file is over 15 MB.' });
      const body = new FormData();
      body.set('dealId', dealId);
      body.set('kind', kind);
      body.set('file', file);
      const response = await fetch(`${BASE_PATH}/api/documents`, { method: 'POST', body }).catch(() => null);
      const result = (await response?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response?.ok || !result?.ok) return setMessage({ tone: 'error', text: result?.error ?? 'The upload did not finish. Try again.' });
      setMessage({ tone: 'ok', text: `${file.name} added.` });
      if (input.current) input.current.value = '';
      router.refresh();
    });

  const documentUrl = (id: string, mode: 'view' | 'download') => `${BASE_PATH}/api/documents/${id}?mode=${mode}`;

  return (
    <div className="space-y-3">
      {documents.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 bg-paper-raised px-3 py-2">
              <FileText aria-hidden className="h-5 w-5 shrink-0 text-ink-mute" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.original_name}</p>
                <p className="text-xs text-ink-mute">
                  {doc.kind} · {size(doc.size_bytes)} {doc.source === 'web' ? '· from the website' : ''}
                </p>
              </div>
              {/* Plain links: the CRM checks access and records the view or download. */}
              <Button asChild variant="ghost" size="icon">
                <a href={documentUrl(doc.id, 'view')} target="_blank" rel="noopener noreferrer" aria-label={`View ${doc.original_name}`}>
                  <Eye aria-hidden className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="ghost" size="icon">
                <a href={documentUrl(doc.id, 'download')} aria-label={`Download ${doc.original_name}`}>
                  <Download aria-hidden className="h-4 w-4" />
                </a>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">No documents yet.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div>
          <Label htmlFor={`kind-${dealId}`} className="sr-only">Document type</Label>
          <Select id={`kind-${dealId}`} value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="other">Other</option>
            <option value="id">ID</option>
            <option value="bill">Bill</option>
            <option value="contract">Contract</option>
            <option value="photo">Photo</option>
          </Select>
        </div>
        <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-paper-raised px-4 text-sm font-semibold hover:bg-paper-sunk">
          <Upload aria-hidden className="h-4 w-4" />
          {pending ? 'Working…' : 'Upload PDF or photo (max 15 MB)'}
          <input
            ref={input}
            type="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/*"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
            }}
          />
        </label>
      </div>
      {message ? <FormNotice tone={message.tone}>{message.text}</FormNotice> : null}
    </div>
  );
}
