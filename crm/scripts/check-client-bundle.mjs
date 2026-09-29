#!/usr/bin/env node
/**
 * Runs after `next build`. Fails (exit 1) if anything that must stay on the
 * server shows up in the files shipped to browsers (.next/static):
 *
 *   - the service-role env var NAME
 *   - the VALUES of the service-role key, the publishable key and the session
 *     secret, whenever they are set in the build environment (Vercel sets them)
 *   - anything shaped like a Supabase secret key
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const appDir = join(import.meta.dirname, '..');
const staticDir = join(appDir, '.next', 'static');

// Next loads these for itself but not for this script. Load them too, without
// overriding variables already set (on Vercel the real values are in the env).
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
  { label: 'service-role env var name', value: ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_') },
  { label: 'service-role key value', value: process.env.SUPABASE_SERVICE_ROLE_KEY },
  { label: 'publishable key value', value: process.env.SUPABASE_PUBLISHABLE_KEY },
  { label: 'session secret value', value: process.env.CRM_SESSION_SECRET },
].filter((needle) => needle.value && needle.value.length >= 12);
const secretShape = /sb_secret_[A-Za-z0-9_-]{10,}/;

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
  if (secretShape.test(text)) hits.push(`${path}: looks like a Supabase secret key`);
}

if (hits.length) {
  console.error(`check-client-bundle: FAILED\n  - ${hits.join('\n  - ')}`);
  process.exit(1);
}
console.log(`check-client-bundle: ok (${scanned} files, ${needles.length} secrets checked)`);
