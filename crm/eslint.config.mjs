import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Privileged modules must never reach a client component. `server-only`
    // makes that a build error; this makes it a lint error first.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/admin/**', 'src/lib/ingest/ingest.ts', 'src/lib/cron/**', 'src/lib/supabase/service-role.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/lib/supabase/service-role', message: 'Service-role client: allowed only in allow-listed server modules (scripts/check-service-role.mjs).' }],
      }],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts', 'supabase/**']),
]);
