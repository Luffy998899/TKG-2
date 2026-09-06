import type { FieldConfig } from '@/lib/form-schema';
import { serialiseValues } from '@/lib/form-schema';
import { compressImages } from '@/lib/compress-image';

/**
 * Posts a completed form to /api/inquiry.
 *
 * Shared by `<InquiryForm>` and the telecom availability flow so there is one
 * place that decides how a submission is shaped - JSON when there are no
 * attachments, multipart when there are, with photos shrunk in the browser
 * first (see src/lib/compress-image.ts).
 *
 * Throws on failure with a message safe to show the customer.
 */
export async function submitInquiry({
  source,
  fields,
  values,
}: {
  /** Which page the inquiry came from, e.g. "division:telecommunications". */
  source: string;
  fields: FieldConfig[];
  values: Record<string, unknown>;
}): Promise<{ id?: string }> {
  const attachments: Record<string, File[]> = {};

  for (const field of fields) {
    if (field.type !== 'file') continue;
    const list = values[field.name];
    const picked = typeof FileList !== 'undefined' && list instanceof FileList ? Array.from(list) : [];
    if (picked.length === 0) continue;
    attachments[field.name] = field.compressImages ? await compressImages(picked) : picked;
  }

  const payload = {
    source,
    submittedAt: new Date().toISOString(),
    // Files are described as { name, type, size } in the payload; the bytes
    // travel as multipart parts alongside it.
    values: serialiseValues(values, attachments),
  };

  const names = Object.keys(attachments);
  let response: Response;

  if (names.length > 0) {
    const body = new FormData();
    body.append('payload', JSON.stringify(payload));
    for (const name of names) {
      for (const file of attachments[name]) body.append(name, file, file.name);
    }
    response = await fetch('/api/inquiry', { method: 'POST', body });
  } else {
    response = await fetch('/api/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed with ${response.status}`);
  }

  return (await response.json().catch(() => ({}))) as { id?: string };
}
