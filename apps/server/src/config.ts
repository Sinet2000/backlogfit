import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOUR_MS, type Limits as RoomLimits } from '@backlogfit/core';
import { type Limits, readLimits } from '@backlogfit/security';

export interface ServerConfig {
  port: number;
  host: string;
  /** Exact origins allowed to open WebSockets and POST rooms (PUBLIC_ORIGIN + ALLOWED_ORIGINS). */
  origins: string[];
  publicOrigin: string;
  /** Directory for backlogfit.sqlite, or null for an in-memory database. */
  dataDir: string | null;
  /** Static web build directory (may not exist). */
  webDir: string;
  limits: Limits;
  trustProxy: boolean;
  /** Security headers without HSTS / upgrade-insecure-requests (dev, or plain-http origin). */
  dev: boolean;
  /** Test-only clock acceleration (1 = real time). Honoured only when NODE_ENV=test. */
  timeScale: number;
  /** Seconds between WebSocket pings; a socket that missed one pong is dropped. */
  heartbeatSeconds: number;
  /** Seconds a socket may stay open without completing a hello. */
  helloTimeoutSeconds: number;
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
    publicOrigin,
    dataDir: env.DATA_DIR ? resolve(env.DATA_DIR) : null,
    webDir: resolve(env.WEB_DIR || resolve(APP_DIR, '../web/build')),
    limits: readLimits(env),
    trustProxy: env.TRUST_PROXY === 'true',
    // HSTS and upgrade-insecure-requests only make sense when the public origin is https.
    dev: env.NODE_ENV !== 'production' || publicOrigin.startsWith('http:'),
    timeScale,
    heartbeatSeconds: int(env, 'HEARTBEAT_SECONDS', 30, 1, 3600),
    helloTimeoutSeconds: int(env, 'HELLO_TIMEOUT_SECONDS', 20, 1, 3600),
  };
}

/** Map env-level limits onto the reducer's limits. */
export function roomLimits(l: Limits): RoomLimits {
  return {
    maxLifetimeMs: l.maxLifetimeHours * HOUR_MS,
    idleTimeoutMs: l.idleTimeoutMinutes * 60_000,
    maxParticipants: l.maxParticipants,
    maxTasks: l.maxTasks,
    passcodeMaxAttempts: l.passcodeMaxAttempts,
  };
}
