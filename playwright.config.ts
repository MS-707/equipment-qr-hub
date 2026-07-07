import { defineConfig, devices } from '@playwright/test'

/**
 * E2E harness (UX-10 / DM-10): runs against a PRODUCTION build (next start)
 * so specs exercise real auth gates, the service worker, and prod bundles.
 * Auth uses the email-code worker path (ALLOW_EMAIL_LOGIN + EMAIL_LOGIN_CODE)
 * because the dev provider is hard-disabled in production builds by design.
 *
 * `npm run build` must have run first (CI does; the loop's gates do).
 * Browsers: preinstalled in the remote env via PLAYWRIGHT_BROWSERS_PATH —
 * never run `playwright install` there.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:3020',
    trace: 'retain-on-failure',
    // Remote env ships browsers at PLAYWRIGHT_BROWSERS_PATH but revisions can
    // lag the runner — pin the provided binary instead of downloading.
    // Locally/CI (no /opt binary) the default resolution applies.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npx next start -p 3020',
    url: 'http://localhost:3020',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXTAUTH_SECRET: 'e2e-dummy-secret-never-production',
      NEXTAUTH_URL: 'http://localhost:3020',
      ALLOW_EMAIL_LOGIN: '1',
      EMAIL_LOGIN_CODE: 'e2e-access-code',
    },
  },
})
