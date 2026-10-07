#!/usr/bin/env node
/**
 * Runs after `next build`. Fails (exit 1) if anything that must stay on the
 * server shows up in the files shipped to browsers (.next/static):
 *
 *   - the DATABASE_URL env var NAME
 *   - the VALUES of DATABASE_URL and every secret, whenever they are set in
 *     the build environment (update.sh builds with the real ones)
 *   - anything shaped like a database URL with a password in it
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const appDir = join(import.meta.dirname, '..');
const staticDir = join(appDir, '.next', 'static');

// Next loads these for itself but not for this script. Load them too, without
// overriding variables already set.
for (const file of ['.env.production.local', '.env.local', '.env.production', '.env']) {
  const path = join(appDir, file);
  if (existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
if (!existsSync(staticDir)) {
  console.error('check-client-bundle: .next/static not found - run after next build');
  process.exit(1);
}

const needles = [
  { label: 'database URL env var name', value: ['DATABASE', 'URL'].join('_') },
  { label: 'database URL value', value: process.env.DATABASE_URL },
  { label: 'session secret value', value: process.env.CRM_SESSION_SECRET },
  { label: 'ingest secret value', value: process.env.CRM_INGEST_SECRET },
  { label: 'cron secret value', value: process.env.CRON_SECRET },
  { label: 'Resend key value', value: process.env.RESEND_API_KEY },
].filter((needle) => needle.value && needle.value.length >= 12);
const urlWithPassword = /postgres(?:ql)?:\/\/[^\s'"/:@]+:[^\s'"@]+@/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const hits = [];
let scanned = 0;
for (const path of walk(staticDir)) {
  const text = readFileSync(path, 'utf8');
  scanned += 1;
  for (const needle of needles) if (text.includes(needle.value)) hits.push(`${path}: ${needle.label}`);
  if (urlWithPassword.test(text)) hits.push(`${path}: looks like a database URL with a password`);
}

if (hits.length) {
  console.error(`check-client-bundle: FAILED\n  - ${hits.join('\n  - ')}`);
  process.exit(1);
}
console.log(`check-client-bundle: ok (${scanned} files, ${needles.length} secrets checked)`);
