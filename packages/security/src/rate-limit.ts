export interface RateLimitOptions {
  /** Tokens refilled per second. Finite, > 0. */
  rate: number;
  /** Bucket capacity. Finite, >= 1. */
  burst: number;
  /** Upper bound on tracked keys; the least recently used key is evicted first. */
  maxKeys?: number;
}

interface Bucket {
  tokens: number;
  at: number;
}

function assertOptions(opts: RateLimitOptions): number {
  if (!Number.isFinite(opts.rate) || opts.rate <= 0) throw new Error('rate must be > 0');
  if (!Number.isFinite(opts.burst) || opts.burst < 1) throw new Error('burst must be >= 1');
  const maxKeys = opts.maxKeys ?? 10_000;
  if (!Number.isInteger(maxKeys) || maxKeys < 1) throw new Error('maxKeys must be an integer >= 1');
  return maxKeys;
}

/**
 * In-memory token buckets. Keys are never persisted or logged.
 *
 * Guarantees (property-tested): over any window of t seconds a key is granted at most
 * `burst + rate * t` tokens; a clock that goes backwards never grants extra tokens; a
 * non-finite `now` or cost is denied rather than poisoning the bucket.
 */
export function createRateLimiter<K>(opts: RateLimitOptions) {
  const maxKeys = assertOptions(opts);
  const { rate, burst } = opts;
  const buckets = new Map<K, Bucket>();

  function refill(key: K, now: number): Bucket {
    let b = buckets.get(key);
    if (b) {
      // Map order doubles as LRU order.
      buckets.delete(key);
      const elapsed = Math.max(0, now - b.at);
      b.tokens = Math.min(burst, b.tokens + (elapsed / 1000) * rate);
      b.at = Math.max(b.at, now);
    } else {
      while (buckets.size >= maxKeys) {
        const oldest = buckets.keys().next();
        if (oldest.done) break;
        buckets.delete(oldest.value);
      }
      b = { tokens: burst, at: now };
    }
    buckets.set(key, b);
    return b;
  }

  return {
    /** Take `cost` tokens. Returns false (and takes nothing) when not enough are available. */
    take(key: K, now: number, cost = 1): boolean {
      if (!Number.isFinite(now) || !Number.isFinite(cost) || cost < 0) return false;
      const b = refill(key, now);
      if (b.tokens < cost) return false;
      b.tokens -= cost;
      return true;
    },
    /** Tokens currently available (after refill), without taking any. */
    available(key: K, now: number): number {
      const b = buckets.get(key);
      if (!b) return burst;
      if (!Number.isFinite(now)) return 0;
      return Math.min(burst, b.tokens + (Math.max(0, now - b.at) / 1000) * rate);
    },
    delete(key: K): void {
      buckets.delete(key);
    },
    clear(): void {
      buckets.clear();
    },
    get size(): number {
      return buckets.size;
    },
  };
}

export type RateLimiter<K> = ReturnType<typeof createRateLimiter<K>>;

// -----------------------------------------------------------------------------------------------
// Invalid-frame strikes

export interface StrikeOptions {
  /** Strikes within `windowMs` at which the caller should close the connection (1008). */
  max: number;
  /** Strikes older than this are forgotten. Default 60 s. */
  windowMs?: number;
  /** Upper bound on tracked keys (LRU). Default 10 000. */
  maxKeys?: number;
}

/**
 * Counts invalid frames (bad JSON, schema failures, oversize, rate-limited) per key, typically a
 * connection id. `strike()` returns true once the key reaches `max` strikes inside the window.
 */
export function createStrikeCounter<K>(opts: StrikeOptions) {
  if (!Number.isInteger(opts.max) || opts.max < 1) throw new Error('max must be an integer >= 1');
  const windowMs = opts.windowMs ?? 60_000;
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error('windowMs must be > 0');
  const maxKeys = opts.maxKeys ?? 10_000;
  const strikes = new Map<K, number[]>();

  return {
    /** Record a strike. True means "close this connection now". */
    strike(key: K, now: number): boolean {
      if (!Number.isFinite(now)) return true;
      const list = (strikes.get(key) ?? []).filter((t) => now - t < windowMs && t <= now);
      strikes.delete(key);
      list.push(now);
      while (strikes.size >= maxKeys) {
        const oldest = strikes.keys().next();
        if (oldest.done) break;
        strikes.delete(oldest.value);
      }
      strikes.set(key, list.slice(-opts.max));
      return list.length >= opts.max;
    },
    count(key: K, now: number): number {
      return (strikes.get(key) ?? []).filter((t) => now - t < windowMs && t <= now).length;
    },
    delete(key: K): void {
      strikes.delete(key);
    },
    get size(): number {
      return strikes.size;
    },
  };
}

export type StrikeCounter<K> = ReturnType<typeof createStrikeCounter<K>>;
