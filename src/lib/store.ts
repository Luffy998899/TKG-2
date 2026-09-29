import { mkdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, basename, extname } from 'node:path';

/* =========================================================================
   THE DATA STORE.

   Everything the owner changes from /admin, and every form submission, lives
   here. It is deliberately the ONLY module that touches the filesystem, so
   moving to a hosted store later is a one-file swap: keep the exported
   function signatures, replace the bodies.

   WHERE THE DATA LIVES
   --------------------
   A `data/` directory at the project root (gitignored), or wherever
   TKG_DATA_DIR points. Inside it:

     settings.json       owner overrides for src/config/site.ts
     testimonials.json   real, permissioned customer reviews
     submissions.json    every form submission, newest first
     uploads/            resumes and the favicon, renamed to random ids

   HOSTING - READ BEFORE DEPLOYING
   -------------------------------
   This works on any host with a persistent disk (a VPS, Railway, Render, a
   Docker volume). It does NOT persist on Vercel or other serverless hosts,
   where the filesystem is reset on every deploy and is not shared between
   instances. On those hosts, replace the bodies of the functions below with
   a hosted store (Vercel Blob / KV, Postgres, S3 ...). The /admin dashboard
   shows a warning banner when it detects it is running on Vercel.
   ========================================================================= */

/** Detects a host where this store will not persist. Surfaced in /admin. */
export const storeIsEphemeral = (): boolean =>
  Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

/*
 * Where the files go.
 *
 * On a serverless host the deployment bundle is READ-ONLY, so writing to
 * ./data throws EROFS and every form submission fails with a 500 - which is
 * exactly what "We could not send that" was. `/tmp` is the one writable path
 * there. It does not survive between instances, so it is a way of not losing
 * the request rather than a way of keeping it: on those hosts the lead is
 * delivered by `notify()` in src/app/api/inquiry/route.ts (webhook/email) and
 * echoed to the server log. Set TKG_DATA_DIR to a real persistent disk, or
 * swap these bodies for a hosted store, to get durable storage back.
 */
const ROOT =
  process.env.TKG_DATA_DIR ?? (storeIsEphemeral() ? '/tmp/tkg-data' : join(process.cwd(), 'data'));
const UPLOADS = join(ROOT, 'uploads');

/* ------------------------------------------------------------------ types */

/** Owner overrides. Every key optional; absent means "use the code default". */
export interface SiteOverrides {
  tagline?: string;
  description?: string;
  phoneDisplay?: string;
  phoneHref?: string;
  whatsapp?: string;
  email?: string;
  addressLine?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  hours?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  /** Stored filename of the uploaded favicon, in uploads/. */
  favicon?: string;
  /** Bumped on every favicon upload so browsers refetch it. */
  faviconVersion?: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  /** e.g. "Surrey · Home security install". */
  context: string;
  /** Division slug, or 'general'. Drives which page it appears on. */
  division: string;
  /** ISO date the review was given. */
  date: string;
  /**
   * The owner must tick this to publish. A review is only stored with
   * permission recorded, which is what makes "no fake testimonials" a
   * property of the data rather than a promise.
   */
  permissionConfirmed: true;
  createdAt: string;
}

export interface StoredFile {
  field: string;
  /** Random id + original extension, inside uploads/. */
  storedName: string;
  originalName: string;
  size: number;
  type: string;
}

export interface Submission {
  id: string;
  /** e.g. "division:telecommunications", "careers:sales-representative". */
  source: string;
  submittedAt: string;
  values: Record<string, unknown>;
  files: StoredFile[];
  /** ISO time the owner opened it in /admin, or null while unread. */
  readAt: string | null;
}

/* ------------------------------------------------------------ primitives */

async function ensureDirs() {
  await mkdir(UPLOADS, { recursive: true });
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(join(ROOT, name), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Atomic write: temp file then rename, so a crash mid-write cannot corrupt. */
async function writeJson(name: string, value: unknown) {
  await ensureDirs();
  const target = join(ROOT, name);
  const tmp = `${target}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await rename(tmp, target);
}

/* -------------------------------------------------------------- settings */

export async function readOverrides(): Promise<SiteOverrides> {
  return readJson<SiteOverrides>('settings.json', {});
}

export async function writeOverrides(patch: SiteOverrides): Promise<SiteOverrides> {
  const current = await readOverrides();
  const next: SiteOverrides = { ...current };
  // An empty string clears an override, so the code default comes back.
  for (const [key, value] of Object.entries(patch) as [keyof SiteOverrides, string][]) {
    if (value === undefined) continue;
    if (value === '') delete next[key];
    else next[key] = value;
  }
  await writeJson('settings.json', next);
  return next;
}

/* ----------------------------------------------------------- testimonials */

export async function listTestimonials(): Promise<Testimonial[]> {
  return readJson<Testimonial[]>('testimonials.json', []);
}

export async function addTestimonial(
  input: Omit<Testimonial, 'id' | 'createdAt' | 'permissionConfirmed'>,
): Promise<Testimonial> {
  const all = await listTestimonials();
  const record: Testimonial = {
    ...input,
    id: randomUUID(),
    permissionConfirmed: true,
    createdAt: new Date().toISOString(),
  };
  await writeJson('testimonials.json', [record, ...all]);
  return record;
}

export async function deleteTestimonial(id: string): Promise<void> {
  const all = await listTestimonials();
  await writeJson(
    'testimonials.json',
    all.filter((t) => t.id !== id),
  );
}

/* ------------------------------------------------------------ submissions */

export async function listSubmissions(): Promise<Submission[]> {
  return readJson<Submission[]>('submissions.json', []);
}

export async function getSubmission(id: string): Promise<Submission | undefined> {
  return (await listSubmissions()).find((s) => s.id === id);
}

export async function addSubmission(
  input: Omit<Submission, 'id' | 'readAt'>,
): Promise<Submission> {
  const all = await listSubmissions();
  const record: Submission = { ...input, id: randomUUID(), readAt: null };
  await writeJson('submissions.json', [record, ...all]);
  return record;
}

export async function markSubmissionRead(id: string, read: boolean): Promise<void> {
  const all = await listSubmissions();
  const next = all.map((s) =>
    s.id === id ? { ...s, readAt: read ? (s.readAt ?? new Date().toISOString()) : null } : s,
  );
  await writeJson('submissions.json', next);
}

export async function deleteSubmission(id: string): Promise<void> {
  const all = await listSubmissions();
  await writeJson(
    'submissions.json',
    all.filter((s) => s.id !== id),
  );
}

/* ----------------------------------------------------------------- files */

/** Only these extensions are ever written to disk, whatever the client says. */
const ALLOWED_EXT = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.png',
  '.ico',
  '.svg',
  '.jpg',
  '.jpeg',
  // Customer photo uploads: moving/cleaning job photos and telecom bills.
  // .heic is what an iPhone hands over when the user has not enabled
  // "Most Compatible"; it is re-encoded to JPEG in the browser first
  // (src/lib/compress-image.ts) but the extension can survive that.
  '.webp',
  '.heic',
  '.heif',
]);

/**
 * Saves an uploaded file under a random name. The original name is kept in
 * the record for display but never used as a path - it comes from a browser.
 */
export async function saveUpload(file: File, field: string): Promise<StoredFile> {
  await ensureDirs();
  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw new Error(`File type ${ext || '(none)'} is not accepted.`);
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOADS, storedName), buffer);
  return {
    field,
    storedName,
    originalName: basename(file.name),
    size: file.size,
    type: file.type,
  };
}

/** Opens a stored upload for streaming. Refuses anything that is not a bare filename. */
export async function openUpload(storedName: string) {
  if (storedName !== basename(storedName) || storedName.includes('..')) {
    throw new Error('Invalid file name.');
  }
  const path = join(UPLOADS, storedName);
  const info = await stat(path);
  return { stream: createReadStream(path), size: info.size, ext: extname(storedName) };
}
