import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { siphash24 } from '../src/client-ip.ts';
import {
  clientIp,
  createClientKeyer,
  normalizeIp,
  parseTrustProxy,
  resolveClientAddress,
} from '../src/index.ts';

const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => i);

describe('siphash24', () => {
  it('matches the reference vectors', () => {
    // Aumasson & Bernstein, SipHash paper appendix / reference vectors.h (key 00..0f).
    expect(siphash24(bytes(16), bytes(0))).toBe(0x726fdb47dd0e0e31n);
    expect(siphash24(bytes(16), bytes(15))).toBe(0xa129ca6149be45e5n);
    expect(siphash24(bytes(16), bytes(8))).toBe(0x93f5f5799a932462n);
  });
});

describe('normalizeIp', () => {
  it('normalizes v4, v6 and mapped addresses', () => {
    expect(normalizeIp('203.0.113.7')).toBe('4:203.0.113.7');
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('4:203.0.113.7');
    expect(normalizeIp('::FFFF:cb00:7107')).toBe('4:203.0.113.7');
    expect(normalizeIp('2001:db8::1')).toBe('6:2001:db8:0:0');
    expect(normalizeIp('[2001:db8:1:2:3:4:5:6]')).toBe('6:2001:db8:1:2');
    expect(normalizeIp('2001:db8:1:2::ffff')).toBe(normalizeIp('2001:0db8:0001:0002:9::1'));
    expect(normalizeIp('fe80::1%eth0')).toBe('6:fe80:0:0:0');
    expect(normalizeIp('::1')).toBe('6:0:0:0:0');
    expect(normalizeIp('::')).toBe('6:0:0:0:0');
    expect(normalizeIp('::1.2.3.4')).toBe('6:0:0:0:0');
    expect(normalizeIp('64:ff9b::1.2.3.4')).toBe('6:64:ff9b:0:0');
  });
  it('rejects garbage', () => {
    for (const s of [
      '',
      'localhost',
      '256.1.1.1',
      '1.2.3',
      '1.2.3.4.5',
      '1:2:3:4:5:6:7:8:9',
      '1::2::3',
      'gggg::1',
      '12345::1',
      '[::1',
      'unknown',
      '1.2.3.4, 5.6.7.8',
      'a'.repeat(100),
    ]) {
      expect(normalizeIp(s), s).toBeNull();
    }
    expect(normalizeIp(null)).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
  });
  it('never throws and is idempotent on its v4 output', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 80 }), (s) => {
        normalizeIp(s);
      }),
      { numRuns: 2000 },
    );
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        expect(normalizeIp(ip)).toBe(`4:${ip.split('.').map(Number).join('.')}`);
      }),
    );
    fc.assert(
      fc.property(fc.ipV6(), (ip) => {
        expect(normalizeIp(ip)).toMatch(/^[46]:/);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('resolveClientAddress', () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it('ignores forwarding headers unless proxies are trusted', () => {
    const headers = h({ 'x-forwarded-for': '6.6.6.6', 'cf-connecting-ip': '7.7.7.7' });
    expect(resolveClientAddress(headers, '10.0.0.1', false)).toBe('10.0.0.1');
    expect(resolveClientAddress(headers, '10.0.0.1', 0)).toBe('10.0.0.1');
  });
  it('takes the entry appended by the trusted proxy, not the client-supplied ones', () => {
    const headers = h({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' });
    expect(resolveClientAddress(headers, '10.0.0.1', true)).toBe('203.0.113.9');
    expect(resolveClientAddress(headers, '10.0.0.1', 2)).toBe('6.6.6.6');
    expect(resolveClientAddress(headers, '10.0.0.1', 3)).toBe('10.0.0.1');
    expect(resolveClientAddress(h({}), '10.0.0.1', true)).toBe('10.0.0.1');
  });
  it('reads Node-style header records', () => {
    expect(resolveClientAddress({ 'x-forwarded-for': ['1.1.1.1', '2.2.2.2'] }, null, 1)).toBe(
      '2.2.2.2',
    );
    expect(resolveClientAddress({ 'cf-connecting-ip': '3.3.3.3' }, null, 'cloudflare')).toBe(
      '3.3.3.3',
    );
    expect(resolveClientAddress({}, null, 'cloudflare')).toBeNull();
  });
});

describe('parseTrustProxy', () => {
  it('parses the env var', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('TRUE')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('cloudflare')).toBe('cloudflare');
    for (const bad of ['yes', '10', '-1', '1.5', 'on'])
      expect(() => parseTrustProxy(bad)).toThrow();
  });
});

describe('clientIp', () => {
  it('returns an opaque key with no trace of the address', () => {
    const k = clientIp(new Headers(), '203.0.113.7', false);
    expect(k).toMatch(/^ip:[0-9a-f]{16}$/);
    expect(k).not.toContain('203');
    expect(clientIp(new Headers(), '::ffff:203.0.113.7', false)).toBe(k);
    expect(clientIp(new Headers(), 'garbage', false)).toBeNull();
  });
  it('buckets an IPv6 /64 together', () => {
    const a = clientIp({}, '2001:db8:1:2::1', false);
    const b = clientIp({}, '2001:db8:1:2:ffff::9', false);
    const c = clientIp({}, '2001:db8:1:3::1', false);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
  it('uses a random key per keyer', () => {
    const k1 = createClientKeyer();
    const k2 = createClientKeyer();
    expect(k1('4:1.2.3.4')).not.toBe(k2('4:1.2.3.4'));
    const fixed = createClientKeyer(new Uint8Array(16));
    expect(fixed('4:1.2.3.4')).toBe(createClientKeyer(new Uint8Array(16))('4:1.2.3.4'));
  });
});
