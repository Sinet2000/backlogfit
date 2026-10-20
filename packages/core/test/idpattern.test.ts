import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  compileIdMatcher,
  compileIdPattern,
  DEFAULT_ID_PATTERN,
  hasUnsafeChars,
  hasVisibleChar,
  ID_PATTERN_MAX_QUANTIFIED,
  isSafeIdPattern,
  parseClientMessage,
  parseTaskLine,
} from '../src/index.ts';

// Atoms and quantifiers from the supported language, biased towards overlapping sets.
const atom = fc.constantFrom(
  'a',
  'b',
  'A',
  '-',
  '_',
  '.',
  '\\d',
  '\\w',
  '[a-z]',
  '[^b]',
  '[A-Z0-9_]',
  '\\.',
  '#',
);
const quant = fc.constantFrom('', '', '', '', '', '?', '*', '+', '{2}', '{0,5}', '{1,}', '{3,64}');
const pattern = fc
  .array(fc.tuple(atom, quant), { minLength: 1, maxLength: 14 })
  .map((xs) => xs.map(([a, q]) => a + q).join(''))
  .filter((p) => p.length <= 100);
const input = (max: number) =>
  fc.string({ unit: fc.constantFrom('a', 'b', 'A', '1', '-', '_', '#', '.', 'z'), maxLength: max });

function elapsed(fn: () => void): number {
  const t = performance.now();
  fn();
  return performance.now() - t;
}

describe('ID pattern matcher (SEC-001)', () => {
  it('rejects the reported ReDoS patterns and everything regex-only', () => {
    for (const p of [
      `${'a*'.repeat(14)}b`,
      `${'[a-z]+'.repeat(10)}!`,
      `${'\\w?'.repeat(30)}\\w{30}`,
      '(a+)+$',
      '(a|a)*',
      'a|b',
      '^a$',
      '(?=a)a',
      '(a)\\1',
      'a**',
      'a{2}{3}',
      'a{3,2}',
      'a{0}',
      'a{1,65}',
      '[',
      '[]',
      '[z-a]',
      'a b',
      '\\s',
      '\\q',
      '',
      'a'.repeat(101),
    ]) {
      expect(isSafeIdPattern(p), p).toBe(false);
    }
    expect(isSafeIdPattern('a?'.repeat(ID_PATTERN_MAX_QUANTIFIED))).toBe(true);
    expect(isSafeIdPattern('a?'.repeat(ID_PATTERN_MAX_QUANTIFIED + 1))).toBe(false);
  });

  it('accepts the documented forms', () => {
    for (const p of [
      DEFAULT_ID_PATTERN,
      '[A-Z]+-[0-9]+',
      '[A-Z]+#[0-9]+',
      '#?[a-z]+',
      '\\d{1,6}',
      '[^-]+-\\d+',
      'PROJ\\-\\d{1,9}',
      '[-a]x',
      '[a-]x',
      '[\\d_]+',
    ]) {
      expect(isSafeIdPattern(p), p).toBe(true);
    }
  });

  it('matches whole tokens; default pattern ignores case', () => {
    const def = compileIdPattern(null);
    expect(def?.test('scp-1')).toBe(true);
    expect(def?.test('SCP-1x')).toBe(false);
    const m = compileIdMatcher('[A-Z]{2,3}-\\d+');
    expect(m?.test('AB-12')).toBe(true);
    expect(m?.test('ab-12')).toBe(false);
    expect(m?.test('ABCD-1')).toBe(false);
    expect(m?.test(`AB-${'1'.repeat(70)}`)).toBe(false); // over the input cap
    expect(compileIdMatcher('.+')?.test('ü-1')).toBe(true);
  });

  it('agrees with RegExp on short inputs (differential)', () => {
    fc.assert(
      fc.property(pattern, fc.array(input(10), { maxLength: 8 }), (p, tokens) => {
        const mine = compileIdMatcher(p);
        if (mine === null) return;
        // Short inputs keep native backtracking cheap enough for a reference result.
        const re = new RegExp(
          `^(?:${p
            .replace(/\{1,\}/g, '{1,64}')
            .replace(/\*/g, '{0,64}')
            .replace(/\+/g, '{1,64}')})$`,
          'u',
        );
        for (const t of tokens) expect(mine.test(t), `${p} / ${t}`).toBe(re.test(t));
      }),
      { numRuns: 1500 },
    );
  });

  it('every accepted pattern × 64- and 200-char inputs matches in under 50 ms', () => {
    fc.assert(
      fc.property(pattern, input(200), (p, s) => {
        const m = compileIdMatcher(p);
        if (m === null) return;
        const tokens = [s, s.slice(0, 64), 'a'.repeat(64), `${'a'.repeat(63)}!`, 'a'.repeat(200)];
        expect(
          elapsed(() => {
            for (const t of tokens) m.test(t);
          }),
        ).toBeLessThan(50);
      }),
      { numRuns: 500 },
    );
  });

  it('worst-case room line stays fast end to end', () => {
    const worst = `${'[a-z]*'.repeat(ID_PATTERN_MAX_QUANTIFIED)}${'a'.repeat(18)}`;
    expect(isSafeIdPattern(worst)).toBe(true);
    const lines = ['a'.repeat(24), 'a'.repeat(200), `https://x.example/${'a'.repeat(63)}b c`];
    const ms = elapsed(() => {
      for (const line of lines) parseTaskLine(line, { policy: 'ids', idPattern: worst });
    });
    expect(ms).toBeLessThan(50);
  });
});

describe('display name hygiene (SEC-002)', () => {
  const hello = (name: string) =>
    JSON.stringify({ type: 'hello', v: 1, joinSecret: 'j'.repeat(22), name, role: 'voter' });

  it('rejects lone surrogates, invisible fillers, bidi and tag characters', () => {
    for (const name of [
      '\ud800',
      'Ana\udfff',
      'ㅤ',
      'ᅟ',
      '⠀',
      '­',
      '؜',
      'A\u{e0041}',
      'Ana​',
      'Ana‮',
      '⁦Ana',
      '́',
      '͏',
      '️',
    ]) {
      expect(parseClientMessage(hello(name)).ok, JSON.stringify(name)).toBe(false);
    }
  });

  it('keeps ordinary names, accents and emoji', () => {
    for (const name of ['Ana', 'José', 'Zoë', '李雷', 'Ana ☕', 'é', '🚀 Dev']) {
      expect(parseClientMessage(hello(name)).ok, name).toBe(true);
    }
  });

  it('helpers', () => {
    expect(hasVisibleChar(' ́️')).toBe(false);
    expect(hasVisibleChar('a')).toBe(true);
    expect(hasUnsafeChars('\u{1d173}')).toBe(true);
    expect(parseTaskLine('́', { policy: 'links' })).toEqual({ ok: false, error: 'unsafe_chars' });
  });
});
