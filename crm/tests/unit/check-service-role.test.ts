import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const script = join(__dirname, '..', '..', 'scripts', 'check-service-role.mjs');
const run = (root?: string) =>
  spawnSync(process.execPath, root ? [script, root] : [script], { encoding: 'utf8' });

const ENV_NAME = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
const fixtures: string[] = [];

function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'crm-sr-check-'));
  fixtures.push(root);
  const base: Record<string, string> = {
    'src/lib/supabase/service-role.ts': `import 'server-only';\nexport const key = process.env.${ENV_NAME};\n`,
    'src/lib/admin/users.ts': `import 'server-only';\nimport { key } from '@/lib/supabase/service-role';\n`,
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

describe('service-role containment check', () => {
  it('passes on this repository', () => {
    const result = run();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('passes on a clean fixture', () => {
    expect(run(fixture({})).status).toBe(0);
  });

  it('fails when another file reads the key', () => {
    const result = run(fixture({ 'src/app/api/x/route.ts': `const k = process.env.${ENV_NAME};` }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/app/api/x/route.ts: mentions');
  });

  it('fails when a non-allow-listed module imports the service-role client', () => {
    const result = run(fixture({ 'src/app/page.tsx': "import { createServiceRoleClient } from '@/lib/supabase/service-role';" }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/app/page.tsx: imports the service-role client');
  });

  it('fails when a client component imports a privileged module', () => {
    const result = run(fixture({ 'src/components/x.tsx': "'use client';\nimport { inviteUser } from '@/lib/admin/users';" }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('client component imports privileged module');
  });

  it("fails when a privileged module drops import 'server-only'", () => {
    const result = run(fixture({ 'src/lib/admin/users.ts': "import { key } from '@/lib/supabase/service-role';\n" }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/lib/admin/users.ts: must start with import 'server-only'");
  });
});
