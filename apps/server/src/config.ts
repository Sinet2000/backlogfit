import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Limits, parseTrustProxy, readLimits, type TrustProxy } from '@backlogfit/security';

export interface ServerConfig {
  port: number;
  host: string;
  /** Origins allowed to open WebSockets and create rooms: PUBLIC_ORIGIN plus ALLOWED_ORIGINS. */
  origins: string[];
  /** null keeps rooms in memory only (SEC-007). */
  dataDir: string | null;
  webDir: string;
  limits: Limits;
  /** Which proxy hop the client key comes from (SEC-003). */
  trustProxy: TrustProxy;
  maxConnections: number;
  maxConnectionsPerClient: number;
  /** No HSTS or upgrade-insecure-requests: development, or a plain-http public origin. */
  dev: boolean;
  /** Trusted Types enforced and source maps hidden. */
  production: boolean;
  /** Room clock acceleration, only ever above 1 when NODE_ENV=test. */
  timeScale: number;
  heartbeatSeconds: number;
}

type Env = Readonly<Record<string, string | undefined>>;

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function int(env: Env, name: string, def: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return n;
}

function origin(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute http(s) origin`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must be an absolute http(s) origin`);
  }
  return url.origin;
}

export function readConfig(env: Env = process.env): ServerConfig {
  const port = int(env, 'PORT', 8080, 0, 65_535);
  if (env.NODE_ENV === 'production' && !env.PUBLIC_ORIGIN) {
    throw new Error('PUBLIC_ORIGIN is required when NODE_ENV=production');
  }
  const publicOrigin = origin(env.PUBLIC_ORIGIN || `http://localhost:${port}`, 'PUBLIC_ORIGIN');
  const extra = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((s) => origin(s, 'ALLOWED_ORIGINS'));
  const isTest = env.NODE_ENV === 'test';
  const timeScale = isTest ? int(env, 'TEST_TIME_SCALE', 1, 1, 100_000) : 1;
  return {
    port,
    host: env.HOST || '0.0.0.0',
    origins: [...new Set([publicOrigin, ...extra])],
    dataDir: env.DATA_DIR ? resolve(env.DATA_DIR) : null,
    webDir: resolve(env.WEB_DIR || resolve(APP_DIR, '../web/build')),
    limits: readLimits(env),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    maxConnections: int(env, 'MAX_CONNECTIONS', 5000, 1, 1_000_000),
    maxConnectionsPerClient: int(env, 'MAX_CONNECTIONS_PER_CLIENT', 50, 1, 100_000),
    dev: env.NODE_ENV !== 'production' || publicOrigin.startsWith('http:'),
    production: env.NODE_ENV === 'production',
    timeScale,
    heartbeatSeconds: int(env, 'HEARTBEAT_SECONDS', 30, 1, 3600),
  };
}
