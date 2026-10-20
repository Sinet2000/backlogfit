import { createOriginChecker, type Limits, readLimits } from '@backlogfit/security';

/** Bindings and vars (see wrangler.jsonc). All vars use the same names as the Node server. */
export interface Env {
  ROOMS: DurableObjectNamespace<import('./room-do.ts').RoomDO>;
  ASSETS?: Fetcher;
  /** Workers Rate Limiting binding for POST /api/rooms; optional (in-memory fallback). */
  CREATE_LIMITER?: RateLimit;
  /** Workers Rate Limiting binding for WebSocket upgrades; optional (in-memory fallback). */
  UPGRADE_LIMITER?: RateLimit;
  PUBLIC_ORIGIN?: string;
  ALLOWED_ORIGINS?: string;
  NODE_ENV?: string;
  HELLO_TIMEOUT_SECONDS?: string;
  [key: string]: unknown;
}

export interface WorkerConfig {
  origins: string[];
  limits: Limits;
  dev: boolean;
  /** Fallback upgrade budget per client when UPGRADE_LIMITER is absent. */
  upgradesPerMin: number;
  allowedOrigin: (origin: string | null | undefined) => boolean;
  helloTimeoutMs: number;
}

function strings(env: Env): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string') out[k] = v;
  return out;
}

let cached: { env: Env; config: WorkerConfig } | null = null;

/** Parsed once per isolate. Invalid values throw, so misconfiguration fails loudly. */
export function configOf(env: Env): WorkerConfig {
  if (cached?.env === env) return cached.config;
  const vars = strings(env);
  const publicOrigin = new URL(vars.PUBLIC_ORIGIN || 'http://localhost:8787').origin;
  const extra = (vars.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((s) => new URL(s).origin);
  const timeout = Number(vars.HELLO_TIMEOUT_SECONDS ?? '20');
  const upgrades = Number(vars.WS_UPGRADES_PER_MIN ?? '120');
  const origins = [...new Set([publicOrigin, ...extra])];
  const config: WorkerConfig = {
    origins,
    allowedOrigin: createOriginChecker(origins),
    upgradesPerMin: Number.isInteger(upgrades) && upgrades > 0 ? upgrades : 120,
    limits: readLimits(vars),
    dev: vars.NODE_ENV !== 'production' || publicOrigin.startsWith('http:'),
    helloTimeoutMs: (Number.isInteger(timeout) && timeout > 0 ? timeout : 20) * 1000,
  };
  cached = { env, config };
  return config;
}
