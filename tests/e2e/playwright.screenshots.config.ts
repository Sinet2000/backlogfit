/** `pnpm --filter @backlogfit/e2e screenshots`: README/Manager Guide screenshots and OG images. */
import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './fixtures/env.ts';
import { webServers } from './playwright.shared.ts';

export default defineConfig({
  testDir: './screenshots',
  testMatch: /\.shot\.ts$/,
  outputDir: 'test-results/screenshots',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  },
  webServer: webServers({ fast: false }),
});
