import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './fixtures/env.ts';
import { webServers } from './playwright.shared.ts';

const CI = !!process.env.CI;
const VISUAL = process.platform === 'linux' || process.env.E2E_VISUAL === '1';

export default defineConfig({
  testDir: '.',
  outputDir: 'test-results',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 },
  },
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : 4,
  reporter: CI ? [['list'], ['html', { open: 'never' }], ['github']] : [['list']],
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/__snapshots__/{testFileName}/{arg}-{platform}{ext}',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /(specs|a11y)\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    {
      name: 'firefox',
      testMatch: /specs\/.*\.spec\.ts$/,
      grep: /@smoke/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: /specs\/.*\.spec\.ts$/,
      grep: /@smoke/,
      use: { ...devices['Desktop Safari'] },
    },
    ...(VISUAL
      ? [
          {
            name: 'visual',
            testMatch: /visual\/.*\.spec\.ts$/,
            use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' as const },
          },
        ]
      : []),
  ],
  webServer: webServers({ fast: true }),
});
