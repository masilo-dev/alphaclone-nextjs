const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://alphaclonesystems.com';

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: devices['iPhone 12'].viewport,
        userAgent: devices['iPhone 12'].userAgent,
        isMobile: true,
        hasTouch: true,
      },
      testMatch: /mobile-.*\.spec\.js/,
    },
  ],
});
