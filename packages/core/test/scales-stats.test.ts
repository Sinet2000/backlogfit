import { describe, expect, it } from 'vitest';
import {
  buildCustomScale,
  computeStats,
  consensusFor,
  contrastText,
  gradient,
  NEUTRAL_CARD_COLOR,
  PRESETS,
  presetScale,
  validateScale,
} from '../src/index.ts';

describe('scales', () => {
  it('presets are valid, labeled and colored', () => {
    for (const p of Object.values(PRESETS)) {
      expect(validateScale(p.cards), p.id).toBeNull();
      for (const c of p.cards) {
        expect(c.label.length).toBeGreaterThan(0);
        expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
        if (c.kind === 'special') expect(c.color).toBe(NEUTRAL_CARD_COLOR);
      }
    }
    expect(presetScale('fibonacci').map((c) => c.value)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '5',
      '8',
      '13',
      '21',
      '?',
      '☕',
      '∞',
    ]);
    expect(presetScale('modifiedFibonacci')[1]).toMatchObject({ value: '½', numeric: 0.5 });
    expect(presetScale('tshirt').every((c) => c.kind === 'tshirt')).toBe(true);
  });

  it('presetScale returns copies', () => {
    const a = presetScale('linear');
    (a[0] as { value: string }).value = 'zz';
    expect(presetScale('linear')[0]?.value).toBe('1');
  });

  it('gradient samples the ramp end to end', () => {
    expect(gradient(0)).toEqual([]);
    expect(gradient(1)).toHaveLength(1);
    const g = gradient(5);
    expect(g[0]).toBe('#440154');
    expect(g[4]).toBe('#fde725');
    expect(new Set(gradient(20)).size).toBe(20);
  });

  it('contrastText picks a readable text color', () => {
    expect(contrastText('#fde725')).toBe('#000000');
    expect(contrastText('#440154')).toBe('#ffffff');
  });

  it('builds custom scales with inferred kinds', () => {
    const r = buildCustomScale([
      { value: '1' },
      { value: '½' },
      { value: '3.5' },
      { value: '?' },
      { value: 'Pass', special: true },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scale.map((c) => c.kind)).toEqual([
      'number',
      'number',
      'number',
      'special',
      'special',
    ]);
    expect(r.scale[3]?.label).toBe('Unsure');
    const t = buildCustomScale([{ value: 'Small', label: 'S' }, { value: 'Big' }]);
    expect(t.ok && t.scale.map((c) => [c.kind, c.label])).toEqual([
      ['tshirt', 'S'],
      ['tshirt', 'Big'],
    ]);
  });

  it('rejects invalid custom scales', () => {
    const err = (xs: { value: string; special?: boolean }[]) => {
      const r = buildCustomScale(xs);
      return r.ok ? null : r.error;
    };
    expect(err([{ value: '1' }])).toBe('too_few_cards');
    expect(err(Array.from({ length: 21 }, (_, i) => ({ value: String(i) })))).toBe(
      'too_many_cards',
    );
    expect(err([{ value: '1' }, { value: '1' }])).toBe('duplicate_value');
    expect(err([{ value: '1' }, { value: '1.0' }])).toBe('duplicate_numeric');
    expect(err([{ value: '?' }, { value: '☕' }])).toBe('no_estimable_cards');
    expect(err([{ value: '1' }, { value: 'M' }])).toBe('mixed_kinds');
    expect(err([{ value: '' }, { value: 'M' }])).toBe('invalid_value');
    expect(err([{ value: 'toolongvalue' }, { value: 'M' }])).toBe('invalid_value');
    expect(err([{ value: 'constructor' }, { value: 'M' }])).toBe('invalid_value');
    expect(
      validateScale([
        ...presetScale('linear').slice(0, 2),
        { value: 'x', label: '', kind: 'special', color: '#000000' },
      ]),
    ).toBe('invalid_label');
    expect(
      validateScale([
        { value: '1', label: '1', kind: 'number', color: '#000000' },
        { value: '2', label: '2', kind: 'number', numeric: 2, color: '#000000' },
      ]),
    ).toBe('invalid_numeric');
    expect(
      validateScale([
        { value: 'S', label: 'S', kind: 'tshirt', numeric: 1, color: '#000000' },
        { value: 'M', label: 'M', kind: 'tshirt', color: '#000000' },
      ]),
    ).toBe('invalid_numeric');
    expect(
      validateScale([
        { value: ' S', label: 'S', kind: 'tshirt', color: '#000000' },
        { value: 'M', label: 'M', kind: 'tshirt', color: '#000000' },
      ]),
    ).toBe('invalid_value');
  });
});

describe('stats', () => {
  const fib = presetScale('fibonacci');

  it('computes numeric stats, excluding special cards', () => {
    const s = computeStats(['3', '5', '5', '8', '?', '☕', 'bogus'], fib);
    expect(s.total).toBe(6);
    expect(s.estimableCount).toBe(4);
    expect(s.basis).toBe('numeric');
    expect(s.min).toBe('3');
    expect(s.max).toBe('8');
    expect(s.median).toBe(5);
    expect(s.average).toBe(5.25);
    expect(s.mode).toEqual(['5']);
    expect(s.spreadSteps).toBe(2);
    expect(s.consensus).toBe('split');
    expect(s.suggested).toBe('5');
    expect(s.special.find((x) => x.value === '?')?.count).toBe(1);
    expect(s.distribution.reduce((a, d) => a + d.count, 0)).toBe(4);
  });

  it('handles full, near, even counts and empty input', () => {
    expect(computeStats(['5', '5'], fib).consensus).toBe('full');
    const near = computeStats(['3', '5'], fib);
    expect(near.consensus).toBe('near');
    expect(near.median).toBe(4);
    expect(near.suggested).toBe('5'); // tie goes to the larger card
    expect(near.mode).toEqual(['3', '5']);
    const none = computeStats(['?'], fib);
    expect(none).toMatchObject({
      total: 1,
      median: null,
      consensus: null,
      mode: [],
      suggested: null,
    });
    expect(consensusFor(0)).toBe('full');
  });

  it('uses ordinal positions for t-shirt sizes', () => {
    const s = computeStats(['S', 'M', 'XL'], presetScale('tshirt'));
    expect(s.basis).toBe('ordinal');
    expect(s.median).toBe(2);
    expect(s.min).toBe('S');
    expect(s.max).toBe('XL');
    expect(s.spreadSteps).toBe(3);
    expect(s.suggested).toBe('M');
  });

  it('orders numeric cards by value even if the scale is not sorted', () => {
    const r = buildCustomScale([{ value: '8' }, { value: '1' }, { value: '3' }]);
    if (!r.ok) throw new Error();
    const s = computeStats(['1', '3'], r.scale);
    expect(s.distribution.map((d) => d.value)).toEqual(['1', '3', '8']);
    expect(s.consensus).toBe('near');
  });
});
