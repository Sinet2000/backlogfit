export interface RateLimitOptions {
  /** Tokens refilled per second. */
  rate: number;
  /** Bucket capacity. */
  burst: number;
  /** Upper bound on tracked keys; the oldest key is evicted first. */
  maxKeys?: number;
}

interface Bucket {
  tokens: number;
  at: number;
}

/** In-memory token buckets. Keys are never persisted or logged. */
export function createRateLimiter<K>(opts: RateLimitOptions) {
  const buckets = new Map<K, Bucket>();
  const maxKeys = opts.maxKeys ?? 10_000;

  return {
    take(key: K, now: number, cost = 1): boolean {
      let b = buckets.get(key);
      if (b) {
        b.tokens = Math.min(opts.burst, b.tokens + ((now - b.at) / 1000) * opts.rate);
        b.at = now;
      } else {
        if (buckets.size >= maxKeys) {
          const oldest = buckets.keys().next();
          if (!oldest.done) buckets.delete(oldest.value);
        }
        b = { tokens: opts.burst, at: now };
        buckets.set(key, b);
      }
      if (b.tokens < cost) return false;
      b.tokens -= cost;
      return true;
    },
    delete(key: K): void {
      buckets.delete(key);
    },
    get size(): number {
      return buckets.size;
    },
  };
}

export type RateLimiter<K> = ReturnType<typeof createRateLimiter<K>>;
