const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// In CI, spin up the production build before running tests.
// Locally, developers are expected to have the dev server already running.
const webServer = process.env.CI
    ? {
          command: 'npm run start',
          url: BASE_URL,
          reuseExistingServer: false,
          timeout: 120000,
          env: {
              PORT: '3000',
              NODE_ENV: 'production',
          },
      }
    : {
          command: 'npm run dev',
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 60000,
      };

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 2,
    workers: 1,
    reporter: process.env.CI ? 'github' : 'list',
    webServer,
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
            use: { ...devices['iPhone 12'] },
            testMatch: /mobile-.*\.spec\.js/,
        },
    ],
});
