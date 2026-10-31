import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const preinstalledHeadlessShell =
  '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';
const hasPreinstalledBrowser = fs.existsSync(preinstalledHeadlessShell);

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
    ...(hasPreinstalledBrowser
      ? {
          launchOptions: {
            executablePath: preinstalledHeadlessShell,
          },
        }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
