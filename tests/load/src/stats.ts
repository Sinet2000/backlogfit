import { parseArgs } from 'node:util';

/** Nearest-rank percentile of an unsorted sample (p in 0..100). NaN for an empty sample. */
export function percentile(sample: readonly number[], p: number): number {
  if (sample.length === 0) return Number.NaN;
  const sorted = [...sample].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? Number.NaN;
}

export interface Summary {
  n: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

export function summarize(sample: readonly number[]): Summary {
  const n = sample.length;
  const mean = n === 0 ? Number.NaN : sample.reduce((a, b) => a + b, 0) / n;
  return {
    n,
    p50: percentile(sample, 50),
    p95: percentile(sample, 95),
    p99: percentile(sample, 99),
    max: n === 0 ? Number.NaN : Math.max(...sample),
    mean,
  };
}

export interface LoadOptions {
  url: string;
  origin: string;
  rooms: number;
  clients: number;
  rounds: number;
  timeoutMs: number;
  rampMs: number;
  thinkMs: number;
  json: string | null;
}

export const USAGE = `Usage: node src/load.ts [options]

  --url <http(s)://host:port>  server under test        (default http://localhost:8080)
  --origin <origin>            Origin header to send    (default: origin of --url)
  --rooms <n>                  number of rooms          (default 20)
  --clients <n>                clients per room, incl. the admin (default 20)
  --rounds <n>                 voting rounds per room   (default 3)
  --timeout <ms>               per-step timeout         (default 30000)
  --ramp <ms>                  spread room starts over this window (default 0)
  --think <ms>                 voters pick a card within this time, and rooms pause this
                               long after each reveal, like a real meeting (default 0)
  --json <file>                also write the report as JSON
  --help`;

function posInt(name: string, v: string | undefined, dflt: number, min = 1): number {
  if (v === undefined) return dflt;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new Error(`--${name} must be an integer ≥ ${min}`);
  return n;
}

export function parseOptions(argv: readonly string[]): LoadOptions | 'help' {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      url: { type: 'string' },
      origin: { type: 'string' },
      rooms: { type: 'string' },
      clients: { type: 'string' },
      rounds: { type: 'string' },
      timeout: { type: 'string' },
      ramp: { type: 'string' },
      think: { type: 'string' },
      json: { type: 'string' },
      help: { type: 'boolean' },
    },
    strict: true,
  });
  if (values.help) return 'help';
  const url = new URL(values.url ?? 'http://localhost:8080');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('--url must be http(s)');
  }
  return {
    url: url.origin,
    origin: values.origin ?? url.origin,
    rooms: posInt('rooms', values.rooms, 20),
    clients: posInt('clients', values.clients, 20, 2),
    rounds: posInt('rounds', values.rounds, 3),
    timeoutMs: posInt('timeout', values.timeout, 30_000),
    rampMs: posInt('ramp', values.ramp, 0, 0),
    thinkMs: posInt('think', values.think, 0, 0),
    json: values.json ?? null,
  };
}

export function wsUrl(httpOrigin: string, roomId: string): string {
  const u = new URL(`/ws/${encodeURIComponent(roomId)}`, httpOrigin);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

export function fmtMs(n: number): string {
  return Number.isNaN(n) ? '-' : `${n.toFixed(1)} ms`;
}
