/**
 * Color tokens for every theme × mode. Single source of truth: `scripts/gen-tokens.ts` writes
 * `tokens.css` from this file, and `test/contrast.test.ts` checks WCAG contrast of the pairs
 * the UI actually uses. Edit here, then run `pnpm --filter @backlogfit/web gen:tokens`.
 */

export type ThemeId = 'corporate' | 'colorful';
export type ModeId = 'light' | 'dark' | 'contrast';

export const THEMES: readonly ThemeId[] = ['corporate', 'colorful'];
export const MODES: readonly ModeId[] = ['light', 'dark', 'contrast'];

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentText: string;
  accentSoft: string;
  accent2: string;
  focus: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  shadow: string;
}

const contrast: Palette = {
  bg: '#ffffff',
  surface: '#ffffff',
  surface2: '#ffffff',
  border: '#000000',
  borderStrong: '#000000',
  text: '#000000',
  textMuted: '#1f1f1f',
  accent: '#0030b0',
  accentHover: '#001f73',
  accentText: '#ffffff',
  accentSoft: '#ffffff',
  accent2: '#0030b0',
  focus: '#000000',
  success: '#00562f',
  successSoft: '#ffffff',
  warning: '#5c3b00',
  warningSoft: '#ffffff',
  danger: '#8f0000',
  dangerSoft: '#ffffff',
  shadow: 'rgba(0, 0, 0, 0)',
};

export const PALETTES: Readonly<Record<ThemeId, Record<ModeId, Palette>>> = {
  corporate: {
    light: {
      bg: '#f6f7f9',
      surface: '#ffffff',
      surface2: '#eef1f5',
      border: '#dce1e8',
      borderStrong: '#737d8e',
      text: '#121821',
      textMuted: '#4d5667',
      accent: '#2350c4',
      accentHover: '#1b40a0',
      accentText: '#ffffff',
      accentSoft: '#e7edfb',
      accent2: '#2350c4',
      focus: '#2350c4',
      success: '#1b7346',
      successSoft: '#e2f2e9',
      warning: '#875300',
      warningSoft: '#fcf1d9',
      danger: '#b42318',
      dangerSoft: '#fce7e5',
      shadow: 'rgba(16, 24, 40, 0.08)',
    },
    dark: {
      bg: '#0d1117',
      surface: '#151a22',
      surface2: '#1c222c',
      border: '#2a323e',
      borderStrong: '#768296',
      text: '#e7ebf1',
      textMuted: '#a2abb9',
      accent: '#82a8ff',
      accentHover: '#a3bfff',
      accentText: '#0a1020',
      accentSoft: '#1a2540',
      accent2: '#82a8ff',
      focus: '#95b5ff',
      success: '#62cc93',
      successSoft: '#10281b',
      warning: '#e9b64f',
      warningSoft: '#2c230f',
      danger: '#ff8f80',
      dangerSoft: '#381713',
      shadow: 'rgba(0, 0, 0, 0.45)',
    },
    contrast,
  },
  colorful: {
    light: {
      bg: '#faf8ff',
      surface: '#ffffff',
      surface2: '#f2eefc',
      border: '#e1daf2',
      borderStrong: '#7b7299',
      text: '#1a1430',
      textMuted: '#544b6f',
      accent: '#5d33cc',
      accentHover: '#4a26a8',
      accentText: '#ffffff',
      accentSoft: '#eee8fd',
      accent2: '#0b7480',
      focus: '#5d33cc',
      success: '#13734d',
      successSoft: '#e0f3ea',
      warning: '#875000',
      warningSoft: '#fdefd6',
      danger: '#b3261e',
      dangerSoft: '#fde6e4',
      shadow: 'rgba(40, 20, 90, 0.1)',
    },
    dark: {
      bg: '#110e1c',
      surface: '#191526',
      surface2: '#211c31',
      border: '#332c49',
      borderStrong: '#7f769c',
      text: '#ece8f7',
      textMuted: '#aea6c6',
      accent: '#ab90ff',
      accentHover: '#c3b0ff',
      accentText: '#140c2e',
      accentSoft: '#2a2147',
      accent2: '#52d0da',
      focus: '#bba6ff',
      success: '#5fd09c',
      successSoft: '#0f2a20',
      warning: '#eebb55',
      warningSoft: '#2e2410',
      danger: '#ff8f86',
      dangerSoft: '#3a1616',
      shadow: 'rgba(0, 0, 0, 0.5)',
    },
    contrast,
  },
};

/** Pairs [foreground, background, minimum ratio] that the components rely on. */
export const CONTRAST_PAIRS: readonly [keyof Palette, keyof Palette, number][] = [
  ['text', 'bg', 7],
  ['text', 'surface', 7],
  ['text', 'surface2', 4.5],
  ['textMuted', 'bg', 4.5],
  ['textMuted', 'surface', 4.5],
  ['textMuted', 'surface2', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'surface', 4.5],
  ['accent', 'accentSoft', 4.5],
  ['accentText', 'accent', 4.5],
  ['accentText', 'accentHover', 4.5],
  ['accent2', 'surface', 4.5],
  ['text', 'accentSoft', 4.5],
  ['focus', 'bg', 3],
  ['focus', 'surface', 3],
  ['borderStrong', 'bg', 3],
  ['borderStrong', 'surface', 3],
  ['success', 'surface', 4.5],
  ['success', 'successSoft', 4.5],
  ['warning', 'surface', 4.5],
  ['warning', 'warningSoft', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'dangerSoft', 4.5],
  ['text', 'successSoft', 4.5],
  ['text', 'warningSoft', 4.5],
  ['text', 'dangerSoft', 4.5],
];

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const kebab = (s: string) => s.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`);

function block(selector: string, p: Palette, scheme: 'light' | 'dark', indent = ''): string {
  const lines = Object.entries(p).map(([k, v]) => `${indent}  --color-${kebab(k)}: ${v};`);
  return `${indent}${selector} {\n${indent}  color-scheme: ${scheme};\n${lines.join('\n')}\n${indent}}`;
}

function themeSel(theme: ThemeId): string {
  return theme === 'corporate' ? ':root' : ':root[data-theme="colorful"]';
}

/** Build the color part of tokens.css. Order matters: later blocks win at equal specificity. */
export function buildColorCss(): string {
  const out: string[] = [
    '/* Generated by scripts/gen-tokens.ts from src/lib/styles/palette.ts. Do not edit. */',
  ];
  for (const t of THEMES) out.push(block(themeSel(t), PALETTES[t].light, 'light'));
  out.push('@media (prefers-color-scheme: dark) {');
  for (const t of THEMES) {
    out.push(block(`${themeSel(t)}:not([data-mode])`, PALETTES[t].dark, 'dark', '  '));
  }
  out.push('}');
  for (const t of THEMES) {
    out.push(block(`${themeSel(t)}[data-mode="dark"]`, PALETTES[t].dark, 'dark'));
  }
  out.push('@media (prefers-contrast: more) {');
  for (const t of THEMES) {
    out.push(block(`${themeSel(t)}:not([data-mode])`, PALETTES[t].contrast, 'light', '  '));
  }
  out.push('}');
  for (const t of THEMES) {
    out.push(block(`${themeSel(t)}[data-mode="contrast"]`, PALETTES[t].contrast, 'light'));
  }
  return `${out.join('\n')}\n`;
}
