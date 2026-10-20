/**
 * Web servers shared by the e2e and the screenshot configs.
 *
 * - main (E2E_BASE_URL, default :8080): normal clock. Builds the web app first.
 * - fast (E2E_FAST_URL, default :8081): TEST_TIME_SCALE=60 for idle/hard-expiry specs.
 *
 * Set E2E_BASE_URL to an already running deployment and E2E_NO_SERVER=1 to skip both.
 * E2E_NO_FAST=1 skips the fast server (expiry specs then skip themselves).
 */
import type { PlaywrightTestConfig } from '@playwright/test';
import { BASE_URL, FAST_TIME_SCALE, FAST_URL } from './fixtures/env.ts';

const ROOT = new URL('../..', import.meta.url).pathname;

const BUILD = process.env.E2E_BUILD_CMD ?? 'pnpm --filter @backlogfit/web build';
const START = process.env.E2E_SERVER_CMD ?? 'pnpm --filter @backlogfit/server start';

function serverEnv(base: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: 'test',
    PORT: new URL(base).port || '8080',
    PUBLIC_ORIGIN: new URL(base).origin,
    // Specs create many rooms from one address; the production default (10/min) would trip.
    ROOM_CREATE_PER_MIN: '10000',
    MAX_ROOMS: '5000',
    ...extra,
  };
}

type WebServer = NonNullable<Exclude<PlaywrightTestConfig['webServer'], unknown[]>>;

export function webServers(opts: { fast: boolean }): WebServer[] {
  if (process.env.E2E_NO_SERVER === '1') return [];
  const servers: WebServer[] = [
    {
      command: process.env.E2E_SKIP_BUILD === '1' ? START : `${BUILD} && ${START}`,
      cwd: ROOT,
      url: new URL('/api/health', BASE_URL).toString(),
      reuseExistingServer: true,
      timeout: 240_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: serverEnv(BASE_URL),
    },
  ];
  if (opts.fast && process.env.E2E_NO_FAST !== '1') {
    servers.push({
      command: START,
      cwd: ROOT,
      url: new URL('/api/health', FAST_URL).toString(),
      reuseExistingServer: true,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: serverEnv(FAST_URL, { TEST_TIME_SCALE: String(FAST_TIME_SCALE) }),
    });
  }
  return servers;
}
