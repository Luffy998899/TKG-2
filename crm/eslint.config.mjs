import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The service role (bypasses row level security) is for ingestion and the
    // daily job only. scripts/check-service-role.mjs fails the build too.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/ingest/ingest.ts', 'src/lib/cron/**', 'src/lib/db/service.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/lib/db/service', message: 'Service role: allowed only in ingestion and the daily job (scripts/check-service-role.mjs).' }],
      }],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts', '.data/**']),
]);
