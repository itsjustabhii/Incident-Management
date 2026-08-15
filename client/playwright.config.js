import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration.
 * Tests run against the development server (start it before running E2E tests).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Sequential to avoid race conditions on shared DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  timeout: 30000,

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
