import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        // Tighter limits so abuse paths are quick to exercise.
        bindings: {
          PUBLIC_ORIGIN: 'http://app.test',
          ALLOWED_ORIGINS: 'http://localhost:5173',
          MAX_MESSAGE_BYTES: '1024',
          HELLO_TIMEOUT_SECONDS: '1',
        },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
