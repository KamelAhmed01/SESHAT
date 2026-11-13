import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: {baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', viewport: {width: 1440, height: 900}},
  webServer: {command: 'pnpm start:export', url: 'http://127.0.0.1:4173/', reuseExistingServer: !process.env.CI, timeout: 30_000},
  reporter: 'list',
  timeout: 30_000,
  expect: {timeout: 10_000},
});
