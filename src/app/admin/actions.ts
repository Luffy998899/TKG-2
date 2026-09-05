'use server';

import { redirect } from 'next/navigation';
import { revalidateTag, revalidatePath } from 'next/cache';
import {
  verifyPassword,
  createSession,
  destroySession,
  requireAdmin,
} from '@/lib/admin-auth';
import {
  writeOverrides,
  addTestimonial,
  deleteTestimonial,
  markSubmissionRead,
  deleteSubmission,
  saveUpload,
  type SiteOverrides,
} from '@/lib/store';
import { SITE_TAG, TESTIMONIALS_TAG } from '@/lib/settings';
import { divisions } from '@/config/divisions';

/* =========================================================================
   Server actions for /admin. Every mutating action calls requireAdmin()
   first, then revalidates whatever it changed, then redirects back with a
   flash flag the page turns into a message. No client JavaScript needed.
   ========================================================================= */

const str = (form: FormData, key: string): string =>
  String(form.get(key) ?? '').trim();

/* ------------------------------------------------------------------ auth */

export async function loginAction(form: FormData) {
  const password = str(form, 'password');
  if (!verifyPassword(password)) {
    redirect('/admin/login?error=1');
  }
  createSession();
  redirect('/admin');
}

export async function logoutAction() {
  destroySession();
  redirect('/admin/login');
}

/* -------------------------------------------------------------- settings */

const SETTINGS_KEYS: (keyof SiteOverrides)[] = [
  'tagline',
  'description',
  'phoneDisplay',
  'phoneHref',
  'whatsapp',
  'email',
  'addressLine',
  'locality',
  'region',
  'postalCode',
  'country',
  'hours',
  'facebook',
  'instagram',
  'linkedin',
];

export async function saveSettingsAction(form: FormData) {
  requireAdmin();
  const patch: SiteOverrides = {};
  for (const key of SETTINGS_KEYS) patch[key] = str(form, key);

  // Keep the dialable number and the WhatsApp number in a form the links can
  // use: digits only, with a leading + for tel:.
  if (patch.phoneHref) {
    const digits = patch.phoneHref.replace(/[^\d]/g, '');
    patch.phoneHref = digits ? `+${digits}` : '';
  }
  if (patch.whatsapp) patch.whatsapp = patch.whatsapp.replace(/[^\d]/g, '');

  await writeOverrides(patch);
  revalidateTag(SITE_TAG);
  revalidatePath('/', 'layout');
  redirect('/admin/settings?saved=1');
}

/* ---------------------------------------------------------- testimonials */

export async function addTestimonialAction(form: FormData) {
  requireAdmin();
  const quote = str(form, 'quote');
  const name = str(form, 'name');
  const context = str(form, 'context');
  const division = str(form, 'division') || 'general';
  const date = str(form, 'date') || new Date().toISOString().slice(0, 10);
  const permission = form.get('permission') === 'on';

  if (!quote || !name) redirect('/admin/testimonials?error=missing');
  if (!permission) redirect('/admin/testimonials?error=permission');
  if (division !== 'general' && !divisions.some((d) => d.slug === division)) {
    redirect('/admin/testimonials?error=division');
  }

  await addTestimonial({ quote, name, context, division, date });
  revalidateTag(TESTIMONIALS_TAG);
  revalidatePath('/', 'layout');
  redirect('/admin/testimonials?saved=1');
}

export async function deleteTestimonialAction(form: FormData) {
  requireAdmin();
  await deleteTestimonial(str(form, 'id'));
  revalidateTag(TESTIMONIALS_TAG);
  revalidatePath('/', 'layout');
  redirect('/admin/testimonials?deleted=1');
}

/* ----------------------------------------------------------- submissions */

export async function markReadAction(form: FormData) {
  requireAdmin();
  const id = str(form, 'id');
  await markSubmissionRead(id, str(form, 'read') !== 'false');
  revalidateTag('submissions');
  redirect(str(form, 'back') || `/admin/submissions/${id}`);
}

export async function deleteSubmissionAction(form: FormData) {
  requireAdmin();
  await deleteSubmission(str(form, 'id'));
  revalidateTag('submissions');
  redirect('/admin?deleted=1');
}

/* -------------------------------------------------------------- branding */

const FAVICON_MAX_BYTES = 512 * 1024;

export async function uploadFaviconAction(form: FormData) {
  requireAdmin();
  const file = form.get('favicon');
  if (!(file instanceof File) || file.size === 0) redirect('/admin/branding?error=missing');
  if (file.size > FAVICON_MAX_BYTES) redirect('/admin/branding?error=size');

  try {
    const stored = await saveUpload(file, 'favicon');
    await writeOverrides({ favicon: stored.storedName, faviconVersion: String(Date.now()) });
  } catch {
    redirect('/admin/branding?error=type');
  }
  revalidateTag(SITE_TAG);
  revalidatePath('/', 'layout');
  redirect('/admin/branding?saved=1');
}

export async function clearFaviconAction() {
  requireAdmin();
  await writeOverrides({ favicon: '', faviconVersion: '' });
  revalidateTag(SITE_TAG);
  revalidatePath('/', 'layout');
  redirect('/admin/branding?cleared=1');
}
