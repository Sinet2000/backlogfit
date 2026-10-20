import {
  compileIdMatcher,
  ID_MATCH_MAX_INPUT,
  isSafeIdPattern,
  isValidIdPattern,
  PRESET_VERSION,
  parsePreset,
  parseTaskLine,
  presetScale,
  serializePreset,
} from '@backlogfit/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { nastyString, POLLUTION_KEYS } from './arbitraries.ts';

describe('parsePreset fuzz', () => {
  const valid = () => ({
    format: JSON.parse(serializePreset({ scale: presetScale('fibonacci') })).format as string,
    v: 1,
    name: 'Team deck',
    lifetimeHours: 2,
    config: { scale: presetScale('fibonacci'), taskPolicy: 'ids' },
  });

  it('never throws on arbitrary text or JSON', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ unit: 'binary', maxLength: 300 }), nastyString(80)), (s) => {
        expect(() => parsePreset(s)).not.toThrow();
      }),
      { numRuns: 3000 },
    );
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 5 }), (j) => {
        expect(() => parsePreset(JSON.stringify(j))).not.toThrow();
        expect(() => parsePreset(j)).not.toThrow();
      }),
      { numRuns: 2000 },
    );
  });

  it('rejects extra keys (including prototype keys and a smuggled passcode) everywhere', () => {
    for (const key of [...POLLUTION_KEYS, 'passcode', 'joinSecret', 'adminSecret']) {
      const top = { ...valid(), [key]: 'x' };
      const text = JSON.stringify(valid()).replace(/^\{/, `{${JSON.stringify(key)}:{"x":1},`);
      const inConfig = { ...valid(), config: { ...valid().config, [key]: 'x' } };
      expect(parsePreset(JSON.stringify(top)).ok, key).toBe(false);
      expect(parsePreset(text).ok, key).toBe(false);
      expect(parsePreset(JSON.stringify(inConfig)).ok, key).toBe(false);
    }
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('accepted presets round-trip and carry nothing secret', () => {
    const r = parsePreset(JSON.stringify(valid()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const again = parsePreset(
      serializePreset(r.msg.config, { name: r.msg.name, lifetimeHours: 2 }),
    );
    expect(again).toEqual({ ok: true, msg: { ...r.msg, v: PRESET_VERSION } });
    expect(JSON.stringify(r.msg)).not.toMatch(/passcode|secret|hash/i);
  });

  it('caps the file size', () => {
    const big = JSON.stringify({ ...valid(), name: 'x'.repeat(70 * 1024) });
    expect(parsePreset(big)).toEqual({ ok: false, code: 'too_large' });
  });
});

describe('ID matcher (SEC-001 fix)', () => {
  const atom = fc.oneof(
    fc.constantFrom(
      'A',
      'B',
      'X',
      '1',
      '-',
      '_',
      '\\d',
      '\\w',
      '.',
      '[A-Z]',
      '[0-9]',
      '[^-]',
      '[a-c1-3]',
      '[\\-_]',
      '\\.',
    ),
  );
  const quant = fc.constantFrom('', '', '', '?', '*', '+', '{2}', '{1,3}', '{0,2}', '{2,}');
  const pattern = fc
    .array(fc.tuple(atom, quant), { minLength: 1, maxLength: 10 })
    .map((parts) => parts.map(([a, q]) => a + q).join(''));
  const token = fc.stringMatching(/^[A-Za-z0-9_.-]{0,12}$/);

  it('agrees with RegExp on whole-token matches (differential)', () => {
    let compared = 0;
    let matched = 0;
    fc.assert(
      fc.property(pattern, fc.array(token, { minLength: 1, maxLength: 8 }), (p, tokens) => {
        const m = compileIdMatcher(p);
        if (m === null) return;
        const re = new RegExp(`^(?:${p})$`, 'u');
        for (const t of tokens) {
          compared++;
          const want = re.test(t);
          if (want) matched++;
          expect(m.test(t), `${p} vs ${JSON.stringify(t)}`).toBe(want);
        }
      }),
      { numRuns: 3000 },
    );
    expect(compared).toBeGreaterThan(5000);
    expect(matched).toBeGreaterThan(100);
  });

  it('never throws on arbitrary pattern text and never accepts regex features outside the subset', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ unit: 'binary', maxLength: 120 }), nastyString(40)), (p) => {
        expect(() => isValidIdPattern(p)).not.toThrow();
        if (isSafeIdPattern(p)) {
          expect(p.length).toBeLessThanOrEqual(100);
          const m = compileIdMatcher(p);
          expect(m).not.toBeNull();
          expect(() => m?.test('a'.repeat(ID_MATCH_MAX_INPUT))).not.toThrow();
        }
      }),
      { numRuns: 5000 },
    );
    for (const p of [
      '(a)',
      'a|b',
      '(?=a)',
      'a\\1',
      '^a',
      'a$',
      'a**',
      'a{1,99}',
      '[]',
      '[a',
      'a{2,1}',
    ]) {
      expect(isSafeIdPattern(p), p).toBe(false);
    }
  });

  it('the worst pattern in budget stays cheap on maximal input', () => {
    const p = `${'.*'.repeat(6)}${'.'.repeat(17)}!`;
    expect(isSafeIdPattern(p)).toBe(true);
    const line = 'a'.repeat(ID_MATCH_MAX_INPUT);
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) parseTaskLine(line, { policy: 'ids', idPattern: p });
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});
