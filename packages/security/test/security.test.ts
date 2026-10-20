import { describe, expect, it } from 'vitest';
import {
  contentSecurityPolicy,
  createRateLimiter,
  DEFAULT_LIMITS,
  isAllowedOrigin,
  readLimits,
  securityHeaders,
} from '../src/index.ts';

describe('headers', () => {
  it('has no unsafe sources', () => {
    expect(contentSecurityPolicy()).not.toMatch(/unsafe/);
    expect(securityHeaders()['Referrer-Policy']).toBe('no-referrer');
  });
  it('omits HSTS in dev', () => {
    expect(securityHeaders({ dev: true })['Strict-Transport-Security']).toBeUndefined();
  });
});

describe('rate limiter', () => {
  it('refills over time', () => {
    const rl = createRateLimiter<string>({ rate: 1, burst: 2 });
    expect(rl.take('a', 0)).toBe(true);
    expect(rl.take('a', 0)).toBe(true);
    expect(rl.take('a', 0)).toBe(false);
    expect(rl.take('a', 1000)).toBe(true);
  });
  it('evicts beyond maxKeys', () => {
    const rl = createRateLimiter<number>({ rate: 1, burst: 1, maxKeys: 2 });
    rl.take(1, 0);
    rl.take(2, 0);
    rl.take(3, 0);
    expect(rl.size).toBe(2);
  });
});

describe('origin', () => {
  it('matches exact origins only', () => {
    const allowed = ['https://backlogfit.com'];
    expect(isAllowedOrigin('https://backlogfit.com', allowed)).toBe(true);
    expect(isAllowedOrigin('https://backlogfit.com.evil.io', allowed)).toBe(false);
    expect(isAllowedOrigin('http://backlogfit.com', allowed)).toBe(false);
    expect(isAllowedOrigin(null, allowed)).toBe(false);
    expect(isAllowedOrigin('null', allowed)).toBe(false);
  });
});

describe('limits', () => {
  it('uses defaults and validates', () => {
    expect(readLimits({})).toEqual(DEFAULT_LIMITS);
    expect(readLimits({ MAX_PARTICIPANTS: '20' }).maxParticipants).toBe(20);
    expect(() => readLimits({ MAX_PARTICIPANTS: 'x' })).toThrow();
    expect(() => readLimits({ DEFAULT_LIFETIME_HOURS: '9' })).toThrow();
  });
});
