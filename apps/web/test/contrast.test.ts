import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildColorCss,
  CARD_PALETTES,
  CARD_STEPS,
  CONTRAST_PAIRS,
  contrastRatio,
  MODES,
  PALETTES,
  THEMES,
} from '../src/lib/styles/palette.ts';

const UI = 3;
const TEXT = 4.5;

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

  it('colors.css is up to date with palette.ts', () => {
    const css = readFileSync(new URL('../src/lib/styles/colors.css', import.meta.url), 'utf8');
    expect(css).toBe(buildColorCss());
  });
});

describe('WCAG contrast of card and bar colours', () => {
  for (const theme of THEMES) {
    for (const mode of MODES) {
      const p = PALETTES[theme][mode];
      const cards = CARD_PALETTES[theme][mode];

      it(`${theme}/${mode}: has one entry per ramp step`, () => {
        expect(cards.steps).toHaveLength(CARD_STEPS);
      });

      cards.steps.forEach((s, i) => {
        const step = `step ${i + 1}`;
        it(`${theme}/${mode} ${step}: value ink on the card face ≥ ${TEXT}`, () => {
          expect(contrastRatio(s.ink, s.face)).toBeGreaterThanOrEqual(TEXT);
        });
        it(`${theme}/${mode} ${step}: selected value on the card face ≥ ${TEXT}`, () => {
          const ink = theme === 'corporate' && mode !== 'contrast' ? p.accent : s.ink;
          expect(contrastRatio(ink, s.face)).toBeGreaterThanOrEqual(TEXT);
        });
        it(`${theme}/${mode} ${step}: card edge on the surface ≥ ${UI}`, () => {
          expect(contrastRatio(s.edge, p.surface)).toBeGreaterThanOrEqual(UI);
        });
        it(`${theme}/${mode} ${step}: distribution bar on surface and track ≥ ${UI}`, () => {
          expect(contrastRatio(s.bar, p.surface)).toBeGreaterThanOrEqual(UI);
          expect(contrastRatio(s.bar, p.surface2)).toBeGreaterThanOrEqual(UI);
        });
        if (s.band !== null) {
          const band = s.band;
          it(`${theme}/${mode} ${step}: colour band on the card face ≥ ${UI}`, () => {
            expect(contrastRatio(band, s.face)).toBeGreaterThanOrEqual(UI);
          });
        }
      });

      it(`${theme}/${mode}: special cards are readable and outlined`, () => {
        expect(contrastRatio(cards.special.ink, cards.special.face)).toBeGreaterThanOrEqual(TEXT);
        expect(contrastRatio(cards.special.edge, p.surface)).toBeGreaterThanOrEqual(UI);
        expect(contrastRatio(cards.special.edge, p.surface2)).toBeGreaterThanOrEqual(UI);
      });

      it(`${theme}/${mode}: the face-down card and the selection ring stand out`, () => {
        expect(contrastRatio(p.accentText, p.accent)).toBeGreaterThanOrEqual(TEXT);
        expect(contrastRatio(p.accent, p.surface)).toBeGreaterThanOrEqual(UI);
      });
    }
  }

  it('high contrast uses no colour on cards', () => {
    for (const theme of THEMES) {
      for (const s of CARD_PALETTES[theme].contrast.steps) {
        expect(s).toEqual({
          face: '#ffffff',
          ink: '#000000',
          edge: '#000000',
          band: null,
          bar: '#000000',
        });
      }
    }
  });

  it('a bigger value never gets a lighter band in Corporate light', () => {
    const lum = CARD_PALETTES.corporate.light.steps.map((s) => contrastRatio(s.bar, '#ffffff'));
    expect([...lum].sort((a, b) => a - b)).toEqual(lum);
  });
});

describe('contrastRatio', () => {
  it('matches known values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
