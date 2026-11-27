// Tests run against SITE_URL if set (any address, e.g. the live site), otherwise against a local static server.
//   SITE_URL=https://example.github.io/northlight-SG/ npx playwright test
const { defineConfig, devices } = require('@playwright/test');

const LOCAL = 'http://127.0.0.1:4173/';
const site = process.env.SITE_URL;
const baseURL = (site || LOCAL).replace(/\/?$/, '/'); // trailing slash so "staff.html" resolves under a sub-path

module.exports = defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL },
  webServer: site ? undefined : { command: 'node tests/serve.js', url: LOCAL, reuseExistingServer: !process.env.CI },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
