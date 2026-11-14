import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const fallbackHeadlessShell =
  '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';
const hasInstalledPlaywrightChromium =
  fs.existsSync('/ms-playwright') &&
  fs
    .readdirSync('/ms-playwright')
    .some((entry) => entry.startsWith('chromium-') || entry.startsWith('chromium_headless_shell-'));
const useFallbackHeadlessShell =
  !hasInstalledPlaywrightChromium && fs.existsSync(fallbackHeadlessShell);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
    ...(useFallbackHeadlessShell
      ? {
          launchOptions: {
            executablePath: fallbackHeadlessShell,
          },
        }
      : {}),
  },
  projects: [
    {
      name: 'local-demo',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
      },
    },
    {
      name: 'api-backed',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3000',
        extraHTTPHeaders: {
          'X-OVS-Runtime-Mode': 'BACKEND_API',
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
