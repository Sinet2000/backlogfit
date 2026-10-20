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

/** One step of the card ramp: face and ink of the card, its border, top band and chart bar. */
export interface CardStep {
  face: string;
  ink: string;
  edge: string;
  band: string | null;
  bar: string;
}

export interface CardPalette {
  steps: readonly CardStep[];
  special: { face: string; ink: string; edge: string };
}

export const CARD_STEPS = 8;

function rampSteps(ramp: readonly string[], p: Palette): CardStep[] {
  return ramp.map((c) => ({ face: p.surface, ink: p.text, edge: p.borderStrong, band: c, bar: c }));
}

function tintSteps(rows: readonly [face: string, ink: string, edge: string][]): CardStep[] {
  return rows.map(([face, ink, edge]) => ({ face, ink, edge, band: null, bar: edge }));
}

const contrastCards: CardPalette = {
  steps: Array.from({ length: CARD_STEPS }, () => ({
    face: '#ffffff',
    ink: '#000000',
    edge: '#000000',
    band: null,
    bar: '#000000',
  })),
  special: { face: '#ffffff', ink: '#000000', edge: '#000000' },
};

export const CARD_PALETTES: Readonly<Record<ThemeId, Record<ModeId, CardPalette>>> = {
  corporate: {
    light: {
      steps: rampSteps(
        ['#7189ab', '#5f7ca4', '#4e6e9c', '#3f6193', '#325388', '#27477a', '#1d3b6b', '#132c57'],
        PALETTES.corporate.light,
      ),
      special: { face: '#ffffff', ink: '#121821', edge: '#6b7280' },
    },
    dark: {
      steps: rampSteps(
        ['#6b83a8', '#7890b5', '#879fc3', '#97aed0', '#a8bddc', '#b9cbe6', '#c9d8ef', '#d8e5f8'],
        PALETTES.corporate.dark,
      ),
      special: { face: '#151a22', ink: '#e7ebf1', edge: '#8b93a1' },
    },
    contrast: contrastCards,
  },
  colorful: {
    light: {
      steps: tintSteps([
        ['#ede9fe', '#3b1f7a', '#7c5ce0'],
        ['#e0e7ff', '#2e3a8c', '#5468d4'],
        ['#dbeafe', '#1e3a8a', '#3b76d6'],
        ['#ccfbf1', '#115e59', '#1e8a80'],
        ['#d1fae5', '#065f46', '#1f8a5b'],
        ['#ecfccb', '#3f6212', '#5e8a1e'],
        ['#fef3c7', '#78350f', '#b07812'],
        ['#ffedd5', '#7c2d12', '#c2571e'],
      ]),
      special: { face: '#f1f5f9', ink: '#334155', edge: '#64748b' },
    },
    dark: {
      steps: tintSteps([
        ['#2e2457', '#ddd6fe', '#a78bfa'],
        ['#252b5c', '#c7d2fe', '#818cf8'],
        ['#1e3256', '#bfdbfe', '#60a5fa'],
        ['#133d3a', '#99f6e4', '#2dd4bf'],
        ['#14402f', '#a7f3d0', '#34d399'],
        ['#2b3a14', '#d9f99d', '#a3e635'],
        ['#45330f', '#fde68a', '#fbbf24'],
        ['#4a2412', '#fed7aa', '#fb923c'],
      ]),
      special: { face: '#262a33', ink: '#cbd5e1', edge: '#94a3b8' },
    },
    contrast: contrastCards,
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

function cardVars(c: CardPalette): [string, string][] {
  const vars: [string, string][] = c.steps.flatMap((s, i): [string, string][] => [
    [`card-face-${i + 1}`, s.face],
    [`card-ink-${i + 1}`, s.ink],
    [`card-edge-${i + 1}`, s.edge],
    [`card-band-${i + 1}`, s.band ?? 'transparent'],
    [`card-bar-${i + 1}`, s.bar],
  ]);
  vars.push(
    ['card-special-face', c.special.face],
    ['card-special-ink', c.special.ink],
    ['card-special-edge', c.special.edge],
  );
  return vars;
}

function block(
  selector: string,
  p: Palette,
  cards: CardPalette,
  scheme: 'light' | 'dark',
  indent = '',
): string {
  const lines = [
    ...Object.entries(p).map(([k, v]) => `${indent}  --color-${kebab(k)}: ${v};`),
    ...cardVars(cards).map(([k, v]) => `${indent}  --${k}: ${v};`),
  ];
  return `${indent}${selector} {\n${indent}  color-scheme: ${scheme};\n${lines.join('\n')}\n${indent}}`;
}

function stepRules(): string {
  const props = ['face', 'ink', 'edge', 'band', 'bar'];
  return Array.from({ length: CARD_STEPS }, (_, i) => {
    const n = i + 1;
    const lines = props.map((k) => `  --step-${k}: var(--card-${k}-${n});`);
    return `[data-step="${n}"] {\n${lines.join('\n')}\n}`;
  }).join('\n');
}

function themeSel(theme: ThemeId): string {
  return theme === 'corporate' ? ':root' : ':root[data-theme="colorful"]';
}

/** Builds colors.css. Order matters: later blocks win at equal specificity. */
export function buildColorCss(): string {
  const out: string[] = [];
  const of = (t: ThemeId, m: ModeId) => [PALETTES[t][m], CARD_PALETTES[t][m]] as const;
  for (const t of THEMES) out.push(block(themeSel(t), ...of(t, 'light'), 'light'));
  out.push('@media (prefers-color-scheme: dark) {');
  for (const t of THEMES) {
    out.push(block(`${themeSel(t)}:not([data-mode])`, ...of(t, 'dark'), 'dark', '  '));
  }
  out.push('}');
  for (const t of THEMES) {
    out.push(block(`${themeSel(t)}[data-mode="dark"]`, ...of(t, 'dark'), 'dark'));
  }
  out.push('@media (prefers-contrast: more) {');
  for (const t of THEMES) {
    out.push(block(`${themeSel(t)}:not([data-mode])`, ...of(t, 'contrast'), 'light', '  '));
  }
  out.push('}');
  for (const t of THEMES) {
    out.push(block(`${themeSel(t)}[data-mode="contrast"]`, ...of(t, 'contrast'), 'light'));
  }
  out.push(stepRules());
  return `${out.join('\n')}\n`;
}
