import type { DroppedFile, FieldConfig } from '@/lib/form-schema';
import { formatBytes, planAttachments, serialiseValues, wasNotProcessed } from '@/lib/form-schema';
import { compressImage } from '@/lib/compress-image';

/**
 * Posts a completed form to /api/inquiry.
 *
 * Shared by `<InquiryForm>` and the telecom availability flow so there is one
 * place that decides how a submission is shaped - JSON when there are no
 * attachments, multipart when there are, with photos shrunk in the browser
 * first (see src/lib/compress-image.ts).
 *
 * ATTACHMENTS NEVER COST THE LEAD. Before anything is sent, every file is
 * checked against its field's limit and the request budget
 * (`planAttachments` in src/lib/form-schema.ts). What does not fit is left
 * off, named in the inquiry itself so the team knows to collect it, and
 * returned as `dropped` so the form can tell the customer. If the server still
 * refuses the request for its size, it is sent again with no files at all.
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
}): Promise<{ id?: string; dropped: DroppedFile[] }> {
  const picked: Record<string, File[]> = {};
  const unprocessed = new Set<File>();

  for (const field of fields) {
    if (field.type !== 'file') continue;
    const list = values[field.name];
    const chosen = typeof FileList !== 'undefined' && list instanceof FileList ? Array.from(list) : [];
    if (chosen.length === 0) continue;

    if (!field.compressImages) {
      picked[field.name] = chosen;
      continue;
    }
    picked[field.name] = await Promise.all(
      chosen.map(async (file) => {
        const processed = await compressImage(file);
        // Could not be decoded: never send it at full camera size.
        if (wasNotProcessed(file, processed)) unprocessed.add(processed);
        return processed;
      }),
    );
  }

  const plan = planAttachments(fields, picked, unprocessed);
  const payloadFor = (send: Record<string, File[]>, dropped: DroppedFile[]) => ({
    source,
    submittedAt: new Date().toISOString(),
    // Files are described as { name, type, size } in the payload; the bytes
    // travel as multipart parts alongside it.
    values: {
      ...serialiseValues(values, send),
      // Named in the inquiry, so the notification says what to collect.
      ...(dropped.length ? { attachmentsNotSent: describeDropped(dropped) } : {}),
    },
  });

  const names = Object.keys(plan.send).filter((name) => plan.send[name].length > 0);
  let dropped = plan.dropped;
  let response: Response;

  if (names.length > 0) {
    const body = new FormData();
    body.append('payload', JSON.stringify(payloadFor(plan.send, dropped)));
    for (const name of names) {
      for (const file of plan.send[name]) body.append(name, file, file.name);
    }
    response = await fetch('/api/inquiry', { method: 'POST', body });

    // Refused for size anyway (a proxy with a lower limit than we planned
    // for): the inquiry matters more than the files, so send it without them.
    if (response.status === 413) {
      const all = Object.fromEntries(Object.keys(plan.send).map((name) => [name, [] as File[]]));
      dropped = [
        ...dropped,
        ...names.flatMap((name) =>
          plan.send[name].map((file) => ({
            field: name,
            name: file.name,
            size: file.size,
            reason: 'over-total' as const,
          })),
        ),
      ];
      response = await postJson(payloadFor(all, dropped));
    }
  } else {
    response = await postJson(payloadFor(plan.send, dropped));
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed with ${response.status}`);
  }

  const data = (await response.json().catch(() => ({}))) as { id?: string };
  return { id: data.id, dropped };
}

const postJson = (payload: unknown): Promise<Response> =>
  fetch('/api/inquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

const REASON: Record<DroppedFile['reason'], string> = {
  'too-large': 'too large to upload',
  'over-total': 'over the upload limit for one inquiry',
  unprocessed: 'photo could not be processed in the browser',
};

/** "bill.pdf (9.1 MB, too large to upload); ..." for the team reading the inquiry. */
const describeDropped = (dropped: DroppedFile[]): string =>
  `${dropped
    .map((file) => `${file.name} (${formatBytes(file.size)}, ${REASON[file.reason]})`)
    .join('; ')}. Collect directly from the customer.`;
