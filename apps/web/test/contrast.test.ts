import { readFileSync } from 'node:fs';
import { contrastText, PRESETS } from '@backlogfit/core';
import { describe, expect, it } from 'vitest';
import {
  buildColorCss,
  CONTRAST_PAIRS,
  contrastRatio,
  MODES,
  PALETTES,
  THEMES,
} from '../src/lib/styles/palette.ts';

describe('WCAG contrast of design tokens', () => {
  for (const theme of THEMES) {
    for (const mode of MODES) {
      const p = PALETTES[theme][mode];
      for (const [fg, bg, min] of CONTRAST_PAIRS) {
        it(`${theme}/${mode}: ${fg} on ${bg} ≥ ${min}`, () => {
          expect(contrastRatio(p[fg], p[bg])).toBeGreaterThanOrEqual(min);
        });
      }
    }
  }

  it('contrast mode meets AAA for body text', () => {
    for (const theme of THEMES) {
      const p = PALETTES[theme].contrast;
      expect(contrastRatio(p.text, p.bg)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(p.textMuted, p.bg)).toBeGreaterThanOrEqual(7);
    }
  });

  it('card labels are readable on every preset card color', () => {
    for (const preset of Object.values(PRESETS)) {
      for (const card of preset.cards) {
        expect(contrastRatio(contrastText(card.color), card.color)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('colors.css is up to date with palette.ts', () => {
    const css = readFileSync(new URL('../src/lib/styles/colors.css', import.meta.url), 'utf8');
    expect(css).toBe(buildColorCss());
  });
});

describe('contrastRatio', () => {
  it('matches known values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
