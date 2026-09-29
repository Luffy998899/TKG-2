import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path('./src'),
      // `server-only` throws outside a React Server Components build; tests
      // import server modules directly.
      'server-only': path('./tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 120_000,
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      {
        extends: true,
        test: {
          name: 'db',
          include: ['tests/db/**/*.test.ts'],
          // Reads the LOCAL stack's URL and keys; refuses anything else.
          globalSetup: ['tests/setup/local-stack.ts'],
          setupFiles: ['tests/setup/env.ts'],
          // One shared database: run files one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
