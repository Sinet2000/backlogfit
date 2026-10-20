import { ctEqual as coreCtEqual } from '@backlogfit/core';
import { describe, expect, it } from 'vitest';
import {
  applySecurityHeaders,
  contentSecurityPolicy,
  createOriginChecker,
  createRateLimiter,
  createStrikeCounter,
  ctEqual,
  DEFAULT_LIMITS,
  frameTooLarge,
  headersFile,
  isAllowedOrigin,
  pathHeaders,
  permissionsPolicy,
  readLimits,
  securityHeaders,
  utf8Length,
} from '../src/index.ts';

describe('headers', () => {
  it('has no unsafe sources', () => {
    expect(contentSecurityPolicy()).not.toMatch(/unsafe/);
    expect(securityHeaders()['Referrer-Policy']).toBe('no-referrer');
  });
  it('omits HSTS in dev', () => {
    expect(securityHeaders({ dev: true })['Strict-Transport-Security']).toBeUndefined();
  });
  it('locks down every fetch directive', () => {
    const csp = contentSecurityPolicy();
    for (const d of [
      "default-src 'none'",
      "script-src 'self'",
      "script-src-attr 'none'",
      "style-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "require-trusted-types-for 'script'",
      'trusted-types svelte-trusted-html',
      'upgrade-insecure-requests',
    ]) {
      expect(csp).toContain(d);
    }
  });
  it('drops Trusted Types and upgrade-insecure-requests in dev', () => {
    const csp = contentSecurityPolicy({ dev: true });
    expect(csp).not.toContain('trusted-types');
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(contentSecurityPolicy({ dev: true, trustedTypes: true })).toContain('trusted-types');
    expect(contentSecurityPolicy({ trustedTypes: false })).not.toContain('trusted-types');
  });
  it('accepts extra connect origins and rejects directive injection', () => {
    expect(contentSecurityPolicy({ connectSrc: ['wss://ws.example.com'] })).toContain(
      "connect-src 'self' wss://ws.example.com",
    );
    expect(contentSecurityPolicy({ connectSrc: ['ws://[::1]:8080'] })).toContain('ws://[::1]:8080');
    for (const bad of [
      "wss://x.com; script-src 'unsafe-inline'",
      'wss://x.com/path',
      '*',
      'https:',
      "'unsafe-eval'",
      'WSS://X.COM',
      'wss://x.com\nX-Evil: 1',
    ]) {
      expect(() => contentSecurityPolicy({ connectSrc: [bad] })).toThrow();
    }
  });
  it('sends isolation headers', () => {
    const h = securityHeaders();
    expect(h['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(h['Origin-Agent-Cluster']).toBe('?1');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Strict-Transport-Security']).not.toContain('preload');
    expect(securityHeaders({ hstsPreload: true })['Strict-Transport-Security']).toContain(
      'preload',
    );
  });
  it('denies powerful features but keeps web-share for self', () => {
    const p = permissionsPolicy();
    expect(p).toContain('camera=()');
    expect(p).toContain('browsing-topics=()');
    expect(p).toContain('web-share=(self)');
    expect(p).not.toContain('clipboard-write');
  });
  it('picks cache rules per path', () => {
    expect(pathHeaders('/r')['Cache-Control']).toBe('no-store');
    expect(pathHeaders('/r/')['X-Robots-Tag']).toContain('noindex');
    expect(pathHeaders('/new')['Cache-Control']).toBe('no-store');
    expect(pathHeaders('/api/rooms')['Cache-Control']).toBe('no-store');
    expect(pathHeaders('/_app/immutable/x.js')['Cache-Control']).toContain('immutable');
    expect(pathHeaders('/')['Cache-Control']).toBe('no-cache');
    expect(pathHeaders('/rules')['X-Robots-Tag']).toBeUndefined();
    expect(pathHeaders('/newsletter')['Cache-Control']).toBe('no-cache');
  });
  it('applies headers and strips X-Powered-By', () => {
    const h = new Headers({ 'X-Powered-By': 'Express', Server: 'nginx' });
    applySecurityHeaders(h, '/r');
    expect(h.get('X-Powered-By')).toBeNull();
    expect(h.get('Server')).toBeNull();
    expect(h.get('Cache-Control')).toBe('no-store');
    expect(h.get('Content-Security-Policy')).toContain("default-src 'none'");
    const kept = new Headers({ 'Cache-Control': 'max-age=60' });
    applySecurityHeaders(kept, '/');
    expect(kept.get('Cache-Control')).toBe('max-age=60');
  });
  it('writes a _headers file without duplicate Cache-Control on /*', () => {
    const f = headersFile();
    const star = f.split('\n\n')[0] ?? '';
    expect(star.startsWith('/*\n')).toBe(true);
    expect(star).not.toContain('Cache-Control');
    expect(f).toContain('/r\n  Cache-Control: no-store');
    expect(f).toContain('/_app/immutable/*\n  Cache-Control: public, max-age=31536000, immutable');
  });
});

describe('ctEqual', () => {
  it('is the core implementation', () => {
    expect(ctEqual).toBe(coreCtEqual);
    expect(ctEqual('abc', 'abc')).toBe(true);
    expect(ctEqual('abc', 'abd')).toBe(false);
    expect(ctEqual('abc', 'abcd')).toBe(false);
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
  it('evicts the least recently used key beyond maxKeys', () => {
    const rl = createRateLimiter<number>({ rate: 1, burst: 1, maxKeys: 2 });
    rl.take(1, 0);
    rl.take(2, 0);
    rl.take(1, 0); // 1 is now most recent
    rl.take(3, 0); // evicts 2
    expect(rl.size).toBe(2);
    expect(rl.take(1, 0)).toBe(false); // still tracked, still empty
  });
  it('does not mint tokens when the clock goes backwards', () => {
    const rl = createRateLimiter<string>({ rate: 1, burst: 1 });
    expect(rl.take('a', 10_000)).toBe(true);
    expect(rl.take('a', 0)).toBe(false);
    expect(rl.take('a', 10_500)).toBe(false);
    expect(rl.take('a', 11_000)).toBe(true);
  });
  it('denies non-finite time and invalid costs', () => {
    const rl = createRateLimiter<string>({ rate: 1, burst: 5 });
    expect(rl.take('a', Number.NaN)).toBe(false);
    expect(rl.take('a', 0, -5)).toBe(false);
    expect(rl.take('a', 0, Number.NaN)).toBe(false);
    expect(rl.take('a', 0, 6)).toBe(false);
    expect(rl.available('a', 0)).toBe(5);
  });
  it('rejects nonsensical options', () => {
    expect(() => createRateLimiter({ rate: 0, burst: 1 })).toThrow();
    expect(() => createRateLimiter({ rate: 1, burst: 0 })).toThrow();
    expect(() => createRateLimiter({ rate: Number.NaN, burst: 1 })).toThrow();
    expect(() => createRateLimiter({ rate: 1, burst: 1, maxKeys: 0 })).toThrow();
  });
});

describe('strike counter', () => {
  it('trips at max strikes within the window', () => {
    const s = createStrikeCounter<string>({ max: 3, windowMs: 1000 });
    expect(s.strike('c', 0)).toBe(false);
    expect(s.strike('c', 10)).toBe(false);
    expect(s.strike('c', 20)).toBe(true);
  });
  it('forgets old strikes', () => {
    const s = createStrikeCounter<string>({ max: 2, windowMs: 1000 });
    expect(s.strike('c', 0)).toBe(false);
    expect(s.strike('c', 2000)).toBe(false);
    expect(s.count('c', 2000)).toBe(1);
  });
  it('is bounded', () => {
    const s = createStrikeCounter<number>({ max: 2, maxKeys: 3 });
    for (let i = 0; i < 10; i++) s.strike(i, 0);
    expect(s.size).toBe(3);
    expect(() => createStrikeCounter({ max: 0 })).toThrow();
  });
});

describe('origin', () => {
  const allowed = ['https://backlogfit.com'];
  it('matches exact origins only', () => {
    expect(isAllowedOrigin('https://backlogfit.com', allowed)).toBe(true);
    expect(isAllowedOrigin('https://backlogfit.com.evil.io', allowed)).toBe(false);
    expect(isAllowedOrigin('http://backlogfit.com', allowed)).toBe(false);
    expect(isAllowedOrigin(null, allowed)).toBe(false);
    expect(isAllowedOrigin(undefined, allowed)).toBe(false);
    expect(isAllowedOrigin('', allowed)).toBe(false);
    expect(isAllowedOrigin('null', allowed)).toBe(false);
  });
  it('rejects non-canonical lookalikes', () => {
    for (const o of [
      'https://user@backlogfit.com',
      'https://user:pw@backlogfit.com',
      'https://backlogfit.com:443',
      'https://backlogfit.com:8443',
      'https://backlogfit.com.',
      'https://backlogfit.com/',
      'https://backlogfit.com/path',
      'HTTPS://BACKLOGFIT.COM',
      'https://Backlogfit.com',
      'https://bаcklogfit.com', // Cyrillic а
      'https://xn--bcklogfit-2nh.com',
      ' https://backlogfit.com',
      'https://backlogfit.com ',
      'https://backlogfit.com\n',
      'https://evil.com#@backlogfit.com',
      'https://evil.com?backlogfit.com',
      'https://backlogfit.com@evil.com',
      'wss://backlogfit.com',
      'file://backlogfit.com',
      'https://backlogfit.co',
    ]) {
      expect(isAllowedOrigin(o, allowed), o).toBe(false);
    }
  });
  it('normalizes the allowlist side and fails fast on bad config', () => {
    expect(isAllowedOrigin('https://backlogfit.com', ['https://BACKLOGFIT.com/'])).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173', ['http://localhost:5173'])).toBe(true);
    const check = createOriginChecker(['https://backlogfit.com/', 'http://localhost:8080']);
    expect(check('https://backlogfit.com')).toBe(true);
    expect(check('http://localhost:8080')).toBe(true);
    expect(check('https://backlogfit.com:443')).toBe(false);
    expect(check('null')).toBe(false);
    expect(() => createOriginChecker(['backlogfit.com'])).toThrow();
    expect(() => createOriginChecker(['ftp://backlogfit.com'])).toThrow();
  });
});

describe('limits', () => {
  it('uses defaults and validates', () => {
    expect(readLimits({})).toEqual(DEFAULT_LIMITS);
    expect(readLimits({ MAX_PARTICIPANTS: '20' }).maxParticipants).toBe(20);
    expect(() => readLimits({ MAX_PARTICIPANTS: 'x' })).toThrow();
    expect(() => readLimits({ DEFAULT_LIFETIME_HOURS: '9' })).toThrow();
    expect(readLimits({ SOCKET_TIMEOUT_SECONDS: '120' }).socketTimeoutSeconds).toBe(120);
    expect(() => readLimits({ SOCKET_TIMEOUT_SECONDS: '10' })).toThrow();
    expect(() => readLimits({ HELLO_TIMEOUT_SECONDS: '0' })).toThrow();
    expect(readLimits({ WS_UPGRADES_PER_MIN: '7' }).upgradesPerMin).toBe(7);
  });
  it('rejects every non-decimal integer spelling', () => {
    for (const raw of [
      '1e1',
      '0x14',
      ' 20',
      '20 ',
      '20.0',
      '+20',
      '-1',
      '020',
      '2_0',
      '20n',
      '∞',
    ]) {
      expect(() => readLimits({ MAX_PARTICIPANTS: raw }), raw).toThrow();
    }
  });
});

describe('frames', () => {
  it('counts UTF-8 bytes', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('é')).toBe(2);
    expect(utf8Length('€')).toBe(3);
    expect(utf8Length('😀')).toBe(4);
    expect(utf8Length('\ud800')).toBe(3);
  });
  it('caps text and binary frames', () => {
    expect(frameTooLarge('a'.repeat(16), 16)).toBe(false);
    expect(frameTooLarge('a'.repeat(17), 16)).toBe(true);
    expect(frameTooLarge('€'.repeat(6), 16)).toBe(true);
    expect(frameTooLarge(new Uint8Array(16), 16)).toBe(false);
    expect(frameTooLarge(new ArrayBuffer(17), 16)).toBe(true);
    expect(frameTooLarge([new Uint8Array(8), new Uint8Array(9)], 16)).toBe(true);
    expect(frameTooLarge({ length: 1 }, 16)).toBe(true);
    expect(frameTooLarge(null, 16)).toBe(true);
    expect(frameTooLarge('x', Number.NaN)).toBe(true);
  });
});
