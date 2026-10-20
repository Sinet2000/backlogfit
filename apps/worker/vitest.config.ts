import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          PUBLIC_ORIGIN: 'http://app.test',
          ALLOWED_ORIGINS: 'http://localhost:5173',
          MAX_MESSAGE_BYTES: '1024',
          MAX_PARTICIPANTS: '2',
          HELLO_TIMEOUT_SECONDS: '1',
        },
        ratelimits: {
          CREATE_LIMITER: { namespace_id: '1001', simple: { limit: 10, period: 60 } },
          UPGRADE_LIMITER: { namespace_id: '1002', simple: { limit: 5, period: 60 } },
        },
        assets: {
          directory: 'test/fixtures/web',
          binding: 'ASSETS',
          routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: false },
        },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
