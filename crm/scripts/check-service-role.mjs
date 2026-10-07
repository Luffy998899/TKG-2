#!/usr/bin/env node
/**
 * Fails (exit 1) unless database access is contained to the server:
 *
 *   1. The DATABASE_URL name appears only in allow-listed files (the pool,
 *      the env schema, docs, scripts, tests).
 *   2. The service-role module (src/lib/db/service.ts, bypasses row level
 *      security) is imported only by ingestion and the daily job.
 *   3. Every privileged module starts with `import 'server-only'`, which makes
 *      importing it from a client component a build error.
 *   4. No 'use client' file imports a database, session, file-store or
 *      privileged module, or the `pg` driver.
 *
 * Runs before every `npm run build` (prebuild) and in the test suite.
 *   node scripts/check-service-role.mjs [rootDir]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2] ?? join(import.meta.dirname, '..');
const ENV_NAME = ['DATABASE', 'URL'].join('_');

/** Files allowed to MENTION the variable name. */
const NAME_ALLOWED = new Set([
  'src/lib/db/pool.ts', // the only runtime reader
  'src/lib/env.ts', // validates it is set
  '.env.example',
  'README.md',
  'DEPLOY.md',
  'db/README.md',
]);
const NAME_ALLOWED_PREFIXES = ['tests/', 'scripts/', 'e2e/']; // never bundled

/** The service-role module, and who may import it. */
const PRIVILEGED_MODULE = 'src/lib/db/service.ts';
const IMPORTERS_ALLOWED = new Set([
  'src/lib/ingest/ingest.ts', // website ingestion (HMAC-verified)
  'src/lib/cron/digest.ts', // daily job: expiry engine + digest (CRON_SECRET)
]);
const MUST_BE_SERVER_ONLY = [
  PRIVILEGED_MODULE,
  ...IMPORTERS_ALLOWED,
  'src/lib/auth/session.ts',
  'src/lib/admin/users.ts',
  'src/lib/files/store.ts',
];

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.data', 'coverage', 'test-results', 'playwright-report']);
const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|sql|toml|env|example|html|css|yml|yaml|sh)$|^\.env/;

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
const importRe = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
const SERVER_ONLY_SPEC = /^(pg|@\/lib\/db\/.+|@\/lib\/auth\/session(-core)?|@\/lib\/admin\/.+|@\/lib\/files\/store|@\/lib\/ingest\/.+|@\/lib\/cron\/.+)$/;

for (const path of walk(root)) {
  const file = rel(path);
  const text = readFileSync(path, 'utf8');

  if (text.includes(ENV_NAME)) {
    const allowed = NAME_ALLOWED.has(file) || NAME_ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix));
    if (!allowed) problems.push(`${file}: mentions ${ENV_NAME} (only ${[...NAME_ALLOWED].join(', ')} may)`);
  }

  if (!/\.(ts|tsx|js|jsx|mjs)$/.test(file) || file.startsWith('tests/') || file.startsWith('e2e/') || file.startsWith('scripts/')) continue;
  const isClient = /^\s*['"]use client['"]/m.test(text.slice(0, 200));
  for (const match of text.matchAll(importRe)) {
    const spec = match[1];
    if (isClient && SERVER_ONLY_SPEC.test(spec)) problems.push(`${file}: client component imports server-only module ${spec}`);
    const toService = spec === '@/lib/db/service' || /(^|\/)db\/service$/.test(spec);
    if (toService && !IMPORTERS_ALLOWED.has(file)) {
      problems.push(`${file}: imports the service role (allowed only from ${[...IMPORTERS_ALLOWED].join(', ')})`);
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
