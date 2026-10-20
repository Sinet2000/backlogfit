import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createRateLimiter,
  frameByteLength,
  frameTooLarge,
  isAllowedOrigin,
  readLimits,
  utf8Length,
} from '../src/index.ts';

describe('rate limiter properties', () => {
  it('never grants more than burst + rate·t over any prefix of time', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 100 }),
        fc.array(
          fc.record({
            dt: fc.oneof(fc.integer({ min: 0, max: 50 }), fc.integer({ min: -5000, max: 5000 })),
            cost: fc.oneof(fc.constant(1), fc.integer({ min: 0, max: 5 })),
          }),
          { maxLength: 300 },
        ),
        (rate, burst, steps) => {
          const rl = createRateLimiter<string>({ rate, burst });
          let now = 1_000_000;
          let start: number | null = null;
          let maxNow = Number.NEGATIVE_INFINITY;
          let granted = 0;
          for (const s of steps) {
            now += s.dt;
            start ??= now;
            maxNow = Math.max(maxNow, now);
            if (rl.take('k', now, s.cost)) granted += s.cost;
            // Time "elapsed" is bounded by the furthest point the clock has reached.
            const t = Math.max(0, maxNow - start) / 1000;
            expect(granted).toBeLessThanOrEqual(burst + rate * t + 1e-9);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('keys are independent and bounded', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(50), { maxLength: 200 }), (keys) => {
        const rl = createRateLimiter<number>({ rate: 1, burst: 1, maxKeys: 10 });
        for (const k of keys) rl.take(k, 0);
        expect(rl.size).toBeLessThanOrEqual(10);
      }),
    );
  });

  it('a fresh key always gets exactly burst tokens at one instant', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        (burst, now) => {
          const rl = createRateLimiter<string>({ rate: 1, burst });
          let n = 0;
          while (rl.take('x', now)) n++;
          expect(n).toBe(burst);
        },
      ),
    );
  });
});

describe('origin properties', () => {
  const allowed = ['https://backlogfit.com'];

  it('accepts only the exact canonical string', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 60 }), (s) => {
        expect(isAllowedOrigin(s, allowed)).toBe(s === 'https://backlogfit.com');
      }),
      { numRuns: 3000 },
    );
  });

  it('rejects any mutation of the allowed origin', () => {
    const base = 'https://backlogfit.com';
    const mutation = fc.oneof(
      fc.record({
        k: fc.constant('prefix' as const),
        s: fc.string({ minLength: 1, maxLength: 8 }),
      }),
      fc.record({
        k: fc.constant('suffix' as const),
        s: fc.string({ minLength: 1, maxLength: 8 }),
      }),
      fc.record({
        k: fc.constant('userinfo' as const),
        s: fc.stringMatching(/^[a-z0-9]{1,8}(:[a-z0-9]{0,8})?$/),
      }),
      fc.record({
        k: fc.constant('port' as const),
        s: fc.integer({ min: 0, max: 65535 }).map(String),
      }),
      fc.record({ k: fc.constant('upper' as const), s: fc.nat(base.length - 1).map(String) }),
      fc.record({
        k: fc.constant('homoglyph' as const),
        s: fc.constantFrom('а', 'ɑ', 'ⅽ', 'ο', 'ｌ', 'Ь', 'ḃ'),
      }),
    );
    fc.assert(
      fc.property(mutation, ({ k, s }) => {
        let o: string;
        switch (k) {
          case 'prefix':
            o = s + base;
            break;
          case 'suffix':
            o = base + s;
            break;
          case 'userinfo':
            o = `https://${s}@backlogfit.com`;
            break;
          case 'port':
            o = `${base}:${s}`;
            break;
          case 'upper': {
            const i = Number(s);
            const ch = base[i] ?? '';
            if (ch.toUpperCase() === ch) return; // not a letter
            o = base.slice(0, i) + ch.toUpperCase() + base.slice(i + 1);
            break;
          }
          case 'homoglyph':
            o = `https://b${s}cklogfit.com`;
            break;
        }
        expect(isAllowedOrigin(o, allowed), o).toBe(false);
      }),
      { numRuns: 3000 },
    );
  });
});

describe('readLimits properties', () => {
  it('rejects every value that is not a plain decimal integer in range', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }), (raw) => {
        if (raw === '') return;
        const ok = /^(0|[1-9][0-9]*)$/.test(raw) && Number(raw) >= 2 && Number(raw) <= 500;
        if (ok) expect(readLimits({ MAX_PARTICIPANTS: raw }).maxParticipants).toBe(Number(raw));
        else expect(() => readLimits({ MAX_PARTICIPANTS: raw })).toThrow();
      }),
      { numRuns: 3000 },
    );
  });

  it('rejects fractional, exponent and signed spellings of in-range numbers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 500 }),
        fc.constantFrom('.0', '.5', 'e0', ' ', '\t', '_', 'n'),
        fc.constantFrom('', '+', '0', ' ', '0x'),
        (n, suffix, prefix) => {
          const raw = `${prefix}${n}${suffix}`;
          expect(() => readLimits({ MAX_PARTICIPANTS: raw })).toThrow();
        },
      ),
    );
  });
});

describe('frame size properties', () => {
  it('utf8Length matches TextEncoder', () => {
    const enc = new TextEncoder();
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 200 }), (s) => {
        expect(utf8Length(s)).toBe(enc.encode(s).byteLength);
      }),
      { numRuns: 3000 },
    );
  });
  it('frameTooLarge agrees with the encoded size', () => {
    const enc = new TextEncoder();
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 200 }), fc.nat(600), (s, max) => {
        expect(frameTooLarge(s, max)).toBe(enc.encode(s).byteLength > max);
        expect(frameByteLength(enc.encode(s))).toBe(enc.encode(s).byteLength);
      }),
      { numRuns: 3000 },
    );
  });
});
