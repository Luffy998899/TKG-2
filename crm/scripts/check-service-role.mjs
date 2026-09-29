#!/usr/bin/env node
/**
 * Fails (exit 1) unless the service-role key is contained:
 *
 *   1. The env var name appears only in allow-listed files.
 *   2. The service-role client module is imported only by allow-listed modules.
 *   3. Every privileged module starts with `import 'server-only'`, which makes
 *      importing it from a client component a build error.
 *   4. No 'use client' file imports a privileged module.
 *
 * Runs before every `npm run build` (prebuild) and in the test suite.
 *   node scripts/check-service-role.mjs [rootDir]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2] ?? join(import.meta.dirname, '..');
const ENV_NAME = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');

/** Files allowed to MENTION the variable name. */
const NAME_ALLOWED = new Set([
  'src/lib/supabase/service-role.ts', // the only runtime reader
  '.env.example',
  'README.md',
  'DEPLOY.md', // deployment guide (documentation, never bundled)
  'scripts/check-service-role.mjs',
  'scripts/check-client-bundle.mjs',
  'scripts/bootstrap-admin.mjs', // one-off CLI, never bundled
]);
const NAME_ALLOWED_PREFIXES = ['tests/']; // test harness, never bundled

/** The privileged client module, and who may import it. Add ingestion/cron in later phases. */
const PRIVILEGED_MODULE = 'src/lib/supabase/service-role.ts';
const IMPORTERS_ALLOWED = new Set([
  'src/lib/admin/users.ts', // Q2: user administration
  'src/lib/ingest/ingest.ts', // website ingestion (HMAC-verified)
  'src/lib/cron/digest.ts', // daily cron: expiry engine + digest (CRON_SECRET)
]);
const MUST_BE_SERVER_ONLY = [PRIVILEGED_MODULE, ...IMPORTERS_ALLOWED];

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'coverage', 'test-results', 'playwright-report', '.temp', '.branches']);
const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|sql|toml|env|example|html|css|yml|yaml)$|^\.env/;

/** Local secret files (.env, .env.local ...) hold the value by design and are gitignored. */
const isLocalEnvFile = (name) => /^\.env(\..+)?$/.test(name) && name !== '.env.example';

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || isLocalEnvFile(name)) continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) yield* walk(path);
    else if (TEXT.test(name)) yield path;
  }
}

const rel = (path) => relative(root, path).split(sep).join('/');
const problems = [];
const importRe = /(?:from\s+|import\s*\(\s*|import\s+)['"](@\/lib\/supabase\/service-role|[./]+[^'"]*supabase\/service-role|@\/lib\/admin\/[^'"]+)['"]/g;

for (const path of walk(root)) {
  const file = rel(path);
  const text = readFileSync(path, 'utf8');

  if (text.includes(ENV_NAME)) {
    const allowed = NAME_ALLOWED.has(file) || NAME_ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix));
    if (!allowed) problems.push(`${file}: mentions ${ENV_NAME} (only ${[...NAME_ALLOWED].join(', ')} may)`);
  }

  if (!/\.(ts|tsx|js|jsx|mjs)$/.test(file) || file.startsWith('tests/')) continue;
  const isClient = /^\s*['"]use client['"]/m.test(text.slice(0, 200));
  for (const match of text.matchAll(importRe)) {
    const spec = match[1];
    const toServiceRole = spec.endsWith('supabase/service-role');
    if (isClient) problems.push(`${file}: client component imports privileged module ${spec}`);
    if (toServiceRole && !IMPORTERS_ALLOWED.has(file)) {
      problems.push(`${file}: imports the service-role client (allowed only from ${[...IMPORTERS_ALLOWED].join(', ')})`);
    }
  }
}

for (const file of MUST_BE_SERVER_ONLY) {
  let text = '';
  try {
    text = readFileSync(join(root, file), 'utf8');
  } catch {
    problems.push(`${file}: expected privileged module is missing`);
    continue;
  }
  if (!/^import ['"]server-only['"];?\s*$/m.test(text.split('\n').slice(0, 3).join('\n'))) {
    problems.push(`${file}: must start with import 'server-only'`);
  }
}

if (problems.length) {
  console.error(`check-service-role: FAILED\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log('check-service-role: ok');
