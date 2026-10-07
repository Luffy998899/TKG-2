import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against the LOCAL database and a local dev server only
 * (e2e/stack.ts refuses any non-local database). Paths in the specs are
 * relative ('login'), so they resolve under the /crm base path. Phone-first: the main
 * project is a 375x812 touch device, as requirement 10 specifies.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3001/crm/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'phone-375x812',
      use: { browserName: 'chromium', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
      testIgnore: /desktop\.spec\.ts/,
    },
    {
      name: 'desktop-1280',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
      testMatch: /desktop\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3001/crm/login',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
