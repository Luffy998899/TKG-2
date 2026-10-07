import 'server-only';
import { mkdir, open, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { serverEnv } from '@/lib/env';

/* =============================================================================
   Document files on the server's disk (DOCUMENTS_DIR, outside the web root,
   readable only by the CRM's service user). A file is addressed by its
   `documents.storage_path` - deals/{deal_id}/{document_id} - and nothing else,
   so a path can never point outside the folder.

   Files are written once (O_EXCL): an upload URL cannot overwrite a document.
   Whether anyone may READ a file is decided before this module is called, by
   a row-level-security query on `documents` as that user.
   ========================================================================== */

const STORAGE_PATH = /^deals\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/;

function resolve(storagePath: string): string {
  if (!STORAGE_PATH.test(storagePath)) throw new Error('invalid storage path');
  const root = path.resolve(serverEnv().DOCUMENTS_DIR);
  return path.join(root, ...storagePath.split('/'));
}

/** Writes a new file; false if one already exists at that path. */
export async function writeNewFile(storagePath: string, bytes: Uint8Array): Promise<boolean> {
  const file = resolve(storagePath);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  let handle;
  try {
    handle = await open(file, 'wx', 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
  return true;
}

export async function readStoredFile(storagePath: string): Promise<Buffer | null> {
  try {
    return await readFile(resolve(storagePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function storedFileInfo(storagePath: string): Promise<{ size: number; writtenAt: number } | null> {
  try {
    const info = await stat(resolve(storagePath));
    return { size: info.size, writtenAt: info.mtimeMs };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** True if a file was there to remove. */
export async function removeStoredFile(storagePath: string): Promise<boolean> {
  const existed = (await storedFileInfo(storagePath)) !== null;
  await rm(resolve(storagePath), { force: true });
  return existed;
}
