import { createOriginChecker, type Limits, readLimits } from '@backlogfit/security';

/** Bindings and vars from wrangler.jsonc. Vars use the same names as the Node server. */
export interface Env {
  ROOMS: DurableObjectNamespace<import('./room-do.ts').RoomDO>;
  ASSETS?: Fetcher;
  CREATE_LIMITER?: RateLimit;
  UPGRADE_LIMITER?: RateLimit;
  PUBLIC_ORIGIN?: string;
  ALLOWED_ORIGINS?: string;
  NODE_ENV?: string;
  [key: string]: unknown;
}

export interface WorkerConfig {
  origins: string[];
  limits: Limits;
  dev: boolean;
  allowedOrigin: (origin: string | null | undefined) => boolean;
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
  const origins = [...new Set([publicOrigin, ...extra])];
  const config: WorkerConfig = {
    origins,
    allowedOrigin: createOriginChecker(origins),
    limits: readLimits(vars),
    dev: vars.NODE_ENV !== 'production' || publicOrigin.startsWith('http:'),
  };
  cached = { env, config };
  return config;
}
