/**
 * Client address handling for rate limiting. The result of clientIp() is an opaque, salted
 * 64-bit keyed hash (SipHash-2-4 with a per-process random key), so neither the rate limiter's
 * memory nor anything accidentally logged from it holds a raw IP address. The key changes on
 * every restart, so it cannot be correlated across processes or days.
 *
 * Honest limit: anyone who can read process memory also has the key and could brute-force the
 * IPv4 space. The hashing defends against accidental disclosure (logs, heap snapshots, crash
 * dumps shared for debugging), not against a host-level attacker.
 *
 * IPv6 clients are bucketed by /64, because a single subscriber usually controls a whole /64.
 */

/** `false`/0 = use the socket peer; n = trust n reverse proxies (X-Forwarded-For); or Cloudflare. */
export type TrustProxy = boolean | number | 'cloudflare';

/** Fetch `Headers`, or Node's `IncomingHttpHeaders` (lower-case keys). */
export type HeaderSource =
  | { get(name: string): string | null }
  | Readonly<Record<string, string | readonly string[] | undefined>>;

/** Parses the TRUST_PROXY env var: false|true|1..9|cloudflare. Anything else throws. */
export function parseTrustProxy(raw: string | undefined): TrustProxy {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === '' || v === 'false' || v === '0') return false;
  if (v === 'true') return 1;
  if (v === 'cloudflare') return 'cloudflare';
  if (/^[1-9]$/.test(v)) return Number(v);
  throw new Error('TRUST_PROXY must be false, true, a hop count 1-9, or cloudflare');
}

function header(h: HeaderSource, name: string): string | null {
  if (typeof (h as { get?: unknown }).get === 'function') {
    return (h as { get(name: string): string | null }).get(name);
  }
  const v = (h as Readonly<Record<string, string | readonly string[] | undefined>>)[name];
  if (v === undefined) return null;
  return typeof v === 'string' ? v : v.join(',');
}

// -----------------------------------------------------------------------------------------------
// Address parsing

function parseV4(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((p) => p <= 255) ? parts : null;
}

function parseV6(input: string): number[] | null {
  let s = input;
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);
  if (s.length < 2 || s.length > 45 || !/^[0-9a-fA-F:.]+$/.test(s)) return null;
  let tail: number[] = [];
  const lastColon = s.lastIndexOf(':');
  if (s.includes('.', lastColon)) {
    const v4 = parseV4(s.slice(lastColon + 1));
    if (!v4) return null;
    tail = [((v4[0] ?? 0) << 8) | (v4[1] ?? 0), ((v4[2] ?? 0) << 8) | (v4[3] ?? 0)];
    // Keep a trailing "::" (e.g. "::1.2.3.4"), otherwise drop the separator colon.
    s = s.slice(0, lastColon + 1);
    if (!s.endsWith('::')) s = s.slice(0, -1);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const out: number[] = [];
    for (const g of part.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      out.push(Number.parseInt(g, 16));
    }
    return out;
  };
  const head = toGroups(halves[0] ?? '');
  const rest = halves.length === 2 ? toGroups(halves[1] ?? '') : [];
  if (head === null || rest === null) return null;
  const known = head.length + rest.length + tail.length;
  if (halves.length === 2) {
    if (known > 7) return null;
    return [...head, ...new Array<number>(8 - known).fill(0), ...rest, ...tail];
  }
  return known === 8 ? [...head, ...tail] : null;
}

/**
 * Canonical rate-limit identity of an address: `4:a.b.c.d` or `6:xxxx:xxxx:xxxx:xxxx` (the /64).
 * IPv4-mapped IPv6 (`::ffff:1.2.3.4`, as Node reports dual-stack peers) becomes IPv4.
 * Returns null for anything that is not an IP literal.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (s.length === 0 || s.length > 64) return null;
  if (s.startsWith('[')) {
    const end = s.indexOf(']');
    if (end === -1) return null;
    s = s.slice(1, end);
  }
  const v4 = parseV4(s);
  if (v4) return `4:${v4.join('.')}`;
  const v6 = parseV6(s);
  if (!v6) return null;
  const isMapped = v6.slice(0, 5).every((g) => g === 0) && v6[5] === 0xffff;
  if (isMapped) {
    const hi = v6[6] ?? 0;
    const lo = v6[7] ?? 0;
    return `4:${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return `6:${v6
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(':')}`;
}

/**
 * The raw client address as the server should believe it. Never log or persist the result;
 * pass it straight to clientIp()/clientKey().
 */
export function resolveClientAddress(
  headers: HeaderSource,
  socketAddr: string | null | undefined,
  trustProxy: TrustProxy,
): string | null {
  if (trustProxy === 'cloudflare') {
    return header(headers, 'cf-connecting-ip')?.trim() || null;
  }
  const hops = trustProxy === true ? 1 : trustProxy === false ? 0 : trustProxy;
  if (!Number.isInteger(hops) || hops <= 0) return socketAddr ?? null;
  const xff = header(headers, 'x-forwarded-for');
  if (!xff) return socketAddr ?? null;
  const list = xff
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '');
  // Each trusted proxy appends the peer it saw; the client is `hops` entries from the right.
  // Entries further left are client-controlled and ignored.
  if (list.length < hops) return socketAddr ?? null;
  return list[list.length - hops] ?? null;
}

// -----------------------------------------------------------------------------------------------
// SipHash-2-4 (keyed PRF, 64-bit output)

const MASK = (1n << 64n) - 1n;
const rotl = (x: bigint, b: bigint) => ((x << b) | (x >> (64n - b))) & MASK;

function readU64(bytes: Uint8Array, off: number): bigint {
  let x = 0n;
  for (let i = 7; i >= 0; i--) x = (x << 8n) | BigInt(bytes[off + i] ?? 0);
  return x;
}

/** SipHash-2-4 of `msg` under a 16-byte key. */
export function siphash24(key: Uint8Array, msg: Uint8Array): bigint {
  if (key.length !== 16) throw new Error('siphash key must be 16 bytes');
  const k0 = readU64(key, 0);
  const k1 = readU64(key, 8);
  let v0 = k0 ^ 0x736f6d6570736575n;
  let v1 = k1 ^ 0x646f72616e646f6dn;
  let v2 = k0 ^ 0x6c7967656e657261n;
  let v3 = k1 ^ 0x7465646279746573n;
  const round = () => {
    v0 = (v0 + v1) & MASK;
    v1 = rotl(v1, 13n) ^ v0;
    v0 = rotl(v0, 32n);
    v2 = (v2 + v3) & MASK;
    v3 = rotl(v3, 16n) ^ v2;
    v0 = (v0 + v3) & MASK;
    v3 = rotl(v3, 21n) ^ v0;
    v2 = (v2 + v1) & MASK;
    v1 = rotl(v1, 17n) ^ v2;
    v2 = rotl(v2, 32n);
  };
  const full = msg.length - (msg.length % 8);
  for (let off = 0; off < full; off += 8) {
    const m = readU64(msg, off);
    v3 ^= m;
    round();
    round();
    v0 ^= m;
  }
  let b = BigInt(msg.length & 255) << 56n;
  for (let i = 0; i < msg.length - full; i++) b |= BigInt(msg[full + i] ?? 0) << BigInt(8 * i);
  v3 ^= b;
  round();
  round();
  v0 ^= b;
  v2 ^= 0xffn;
  round();
  round();
  round();
  round();
  return (v0 ^ v1 ^ v2 ^ v3) & MASK;
}

const encoder = new TextEncoder();

/** A keyed hasher for client identities. The key never leaves this closure. */
export function createClientKeyer(key?: Uint8Array): (normalized: string) => string {
  const k = new Uint8Array(16);
  if (key) k.set(key.subarray(0, 16));
  else crypto.getRandomValues(k);
  return (normalized) =>
    `ip:${siphash24(k, encoder.encode(normalized)).toString(16).padStart(16, '0')}`;
}

let processKeyer: ((normalized: string) => string) | null = null;

/**
 * In-memory-only rate-limit key for the client of a request or WebSocket upgrade:
 * `ip:<16 hex>`, or null when no address can be determined (callers should then fall back to a
 * shared bucket such as the literal 'unknown', never to "no limit").
 */
export function clientIp(
  headers: HeaderSource,
  socketAddr: string | null | undefined,
  trustProxy: TrustProxy,
): string | null {
  const normalized = normalizeIp(resolveClientAddress(headers, socketAddr, trustProxy));
  if (normalized === null) return null;
  processKeyer ??= createClientKeyer();
  return processKeyer(normalized);
}
