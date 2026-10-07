import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const script = join(__dirname, '..', '..', 'scripts', 'check-service-role.mjs');
const run = (root?: string) =>
  spawnSync(process.execPath, root ? [script, root] : [script], { encoding: 'utf8' });

const ENV_NAME = ['DATABASE', 'URL'].join('_');
const fixtures: string[] = [];

function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'crm-sr-check-'));
  fixtures.push(root);
  const base: Record<string, string> = {
    'src/lib/db/pool.ts': `export const url = process.env.${ENV_NAME};\n`,
    'src/lib/db/service.ts': `import 'server-only';\nexport const serviceDb = () => null;\n`,
    'src/lib/ingest/ingest.ts': `import 'server-only';\nimport { serviceDb } from '@/lib/db/service';\n`,
    'src/lib/cron/digest.ts': `import 'server-only';\nimport { serviceDb } from '@/lib/db/service';\n`,
    'src/lib/auth/session.ts': `import 'server-only';\n`,
    'src/lib/admin/users.ts': `import 'server-only';\n`,
    'src/lib/files/store.ts': `import 'server-only';\n`,
  };
  for (const [file, text] of Object.entries({ ...base, ...files })) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

afterAll(() => {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true });
});

describe('database containment check', () => {
  it('passes on this repository', () => {
    const result = run();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('passes on a clean fixture', () => {
    expect(run(fixture({})).status).toBe(0);
  });

  it('fails when another file reads the database URL', () => {
    const result = run(fixture({ 'src/app/api/x/route.ts': `const k = process.env.${ENV_NAME};` }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/app/api/x/route.ts: mentions');
  });

  it('fails when a non-allow-listed module imports the service role', () => {
    const result = run(fixture({ 'src/app/page.tsx': "import { serviceDb } from '@/lib/db/service';" }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/app/page.tsx: imports the service role');
  });

  it('fails when a client component imports a database, session or privileged module', () => {
    for (const spec of ['@/lib/db/query', '@/lib/auth/session', '@/lib/admin/users', 'pg']) {
      const result = run(fixture({ 'src/components/x.tsx': `'use client';\nimport { x } from '${spec}';` }));
      expect(result.status, spec).toBe(1);
      expect(result.stderr).toContain('client component imports server-only module');
    }
  });

  it("fails when a privileged module drops import 'server-only'", () => {
    const result = run(fixture({ 'src/lib/db/service.ts': 'export const serviceDb = () => null;\n' }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/lib/db/service.ts: must start with import 'server-only'");
  });
});
