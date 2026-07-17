import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:8080',
    launchOptions: {
      executablePath: '/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless', '--disable-gpu'],
    },
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
