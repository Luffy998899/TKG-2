import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import type { TestProject } from 'vitest/node';

export interface LocalStack {
  url: string;
  publishableKey: string;
  serviceKey: string;
  sessionSecret: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    stack: LocalStack;
  }
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * Reads the running LOCAL Supabase stack (`supabase start`). Hard stop if the
 * API is anything but localhost: these tests create users, deactivate them
 * and write audit rows, and must never touch a hosted project.
 */
export default function setup(project: TestProject) {
  let output: string;
  try {
    output = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
      cwd: project.config.root,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error('The local Supabase stack is not running. Start Docker, then `npm run db:start`.');
  }

  const vars = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2]]),
  ) as Record<string, string | undefined>;

  const url = vars.API_URL;
  const publishableKey = vars.PUBLISHABLE_KEY ?? vars.ANON_KEY;
  const serviceKey = vars.SECRET_KEY ?? vars.SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceKey) {
    throw new Error(`Could not read the local stack's URL and keys from \`supabase status\`:\n${output}`);
  }
  if (!LOCAL_HOSTS.has(new URL(url).hostname)) {
    throw new Error(`Refusing to run database tests against a non-local Supabase: ${url}`);
  }

  project.provide('stack', {
    url,
    publishableKey,
    serviceKey,
    // Fresh per run, so login-lockout hashes never collide between runs.
    sessionSecret: randomBytes(32).toString('base64'),
  });
}
