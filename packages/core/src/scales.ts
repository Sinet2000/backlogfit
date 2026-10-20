import { cleanText, hasUnsafeChars } from './text.ts';

export type CardKind = 'number' | 'tshirt' | 'special';

export interface Card {
  value: string;
  label: string;
  numeric?: number;
  kind: CardKind;
  color: string;
}

export const CARD_VALUE_MAX = 8;
export const CARD_LABEL_MAX = 24;
export const SCALE_MIN_CARDS = 2;
export const SCALE_MAX_CARDS = 20;

export const SPECIAL_UNSURE = '?';
export const SPECIAL_COFFEE = '☕';
export const SPECIAL_INFINITY = '∞';

const SPECIAL_LABELS: Record<string, string> = {
  [SPECIAL_UNSURE]: 'Unsure',
  [SPECIAL_COFFEE]: 'Break',
  [SPECIAL_INFINITY]: 'Too big',
};

export const NEUTRAL_CARD_COLOR = '#8b8f97';

const VIRIDIS = [
  '#440154',
  '#482878',
  '#3e4989',
  '#31688e',
  '#26828e',
  '#1f9e89',
  '#35b779',
  '#6ece58',
  '#b5de2b',
  '#fde725',
] as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/** Sample n colors along the viridis ramp (sRGB interpolation between stops). */
export function gradient(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [VIRIDIS[4]];
  const out: string[] = [];
  const last = VIRIDIS.length - 1;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * last;
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, last);
    const f = t - lo;
    const a = hexToRgb(VIRIDIS[lo] ?? VIRIDIS[0]);
    const b = hexToRgb(VIRIDIS[hi] ?? VIRIDIS[9]);
    out.push(
      rgbToHex([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]),
    );
  }
  return out;
}

function luminance(hex: string): number {
  const lin = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (lin[0] ?? 0) + 0.7152 * (lin[1] ?? 0) + 0.0722 * (lin[2] ?? 0);
}

/** Black or white, whichever has the higher WCAG contrast ratio against `bg`. */
export function contrastText(bg: string): '#000000' | '#ffffff' {
  const l = luminance(bg);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#000000' : '#ffffff';
}

/** Assign gradient colors to non-special cards (in order) and neutral to specials. */
export function colorize(cards: readonly Omit<Card, 'color'>[]): Card[] {
  const colors = gradient(cards.filter((c) => c.kind !== 'special').length);
  let i = 0;
  return cards.map((c) => ({
    ...c,
    color: c.kind === 'special' ? NEUTRAL_CARD_COLOR : (colors[i++] ?? NEUTRAL_CARD_COLOR),
  }));
}

function num(value: string, numeric: number): Omit<Card, 'color'> {
  return { value, label: value, numeric, kind: 'number' };
}

function special(value: string): Omit<Card, 'color'> {
  return { value, label: SPECIAL_LABELS[value] ?? value, kind: 'special' };
}

export type PresetId = 'fibonacci' | 'modifiedFibonacci' | 'tshirt' | 'powersOf2' | 'linear';

export interface ScalePreset {
  id: PresetId;
  name: string;
  cards: Card[];
}

const nums = (xs: readonly number[]) => xs.map((x) => num(String(x), x));

export const PRESETS: Readonly<Record<PresetId, ScalePreset>> = {
  fibonacci: {
    id: 'fibonacci',
    name: 'Fibonacci',
    cards: colorize([
      ...nums([0, 1, 2, 3, 5, 8, 13, 21]),
      special(SPECIAL_UNSURE),
      special(SPECIAL_COFFEE),
      special(SPECIAL_INFINITY),
    ]),
  },
  modifiedFibonacci: {
    id: 'modifiedFibonacci',
    name: 'Modified Fibonacci',
    cards: colorize([num('0', 0), num('½', 0.5), ...nums([1, 2, 3, 5, 8, 13, 20, 40, 100])]),
  },
  tshirt: {
    id: 'tshirt',
    name: 'T-shirt sizes',
    cards: colorize(
      ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((v) => ({ value: v, label: v, kind: 'tshirt' })),
    ),
  },
  powersOf2: {
    id: 'powersOf2',
    name: 'Powers of 2',
    cards: colorize(nums([0, 1, 2, 4, 8, 16, 32, 64])),
  },
  linear: {
    id: 'linear',
    name: 'Linear 1–10',
    cards: colorize(nums([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])),
  },
};

export function presetScale(id: PresetId): Card[] {
  return PRESETS[id].cards.map((c) => ({ ...c }));
}

export type ScaleError =
  | 'too_few_cards'
  | 'too_many_cards'
  | 'duplicate_value'
  | 'invalid_value'
  | 'invalid_label'
  | 'no_estimable_cards'
  | 'mixed_kinds'
  | 'invalid_numeric'
  | 'duplicate_numeric';

/** Structural rules every scale must satisfy (presets, custom, and anything received over the wire). */
export function validateScale(cards: readonly Card[]): ScaleError | null {
  if (cards.length < SCALE_MIN_CARDS) return 'too_few_cards';
  if (cards.length > SCALE_MAX_CARDS) return 'too_many_cards';
  const values = new Set<string>();
  const numerics = new Set<number>();
  const kinds = new Set<CardKind>();
  for (const c of cards) {
    if (c.value.length < 1 || c.value.length > CARD_VALUE_MAX || hasUnsafeChars(c.value)) {
      return 'invalid_value';
    }
    if (c.value !== cleanText(c.value)) return 'invalid_value';
    if (c.label.length < 1 || c.label.length > CARD_LABEL_MAX || hasUnsafeChars(c.label)) {
      return 'invalid_label';
    }
    if (values.has(c.value)) return 'duplicate_value';
    values.add(c.value);
    if (c.kind === 'special') continue;
    kinds.add(c.kind);
    if (c.kind === 'number') {
      if (typeof c.numeric !== 'number' || !Number.isFinite(c.numeric)) return 'invalid_numeric';
      if (numerics.has(c.numeric)) return 'duplicate_numeric';
      numerics.add(c.numeric);
    } else if (c.numeric !== undefined) {
      return 'invalid_numeric';
    }
  }
  if (kinds.size === 0) return 'no_estimable_cards';
  if (kinds.size > 1) return 'mixed_kinds';
  return null;
}

export interface CustomCardInput {
  value: string;
  label?: string;
  special?: boolean;
}

const NUMERIC_TEXT = /^-?\d{1,6}(\.\d{1,3})?$/;
const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };

/**
 * Build a scale from user input. Kinds are inferred: ?, ☕, ∞ (or `special: true`) are special;
 * numeric text (and ½ ¼ ¾) is a number card; anything else is an ordinal (t-shirt style) card.
 */
export function buildCustomScale(
  inputs: readonly CustomCardInput[],
): { ok: true; scale: Card[] } | { ok: false; error: ScaleError } {
  const cards = inputs.map((input): Omit<Card, 'color'> => {
    const value = cleanText(input.value);
    const label = input.label === undefined ? undefined : cleanText(input.label);
    const known = Object.hasOwn(SPECIAL_LABELS, value) ? SPECIAL_LABELS[value] : undefined;
    if (input.special || known !== undefined) {
      return { value, label: label || known || value, kind: 'special' };
    }
    const fraction = Object.hasOwn(FRACTIONS, value) ? FRACTIONS[value] : undefined;
    if (fraction !== undefined || NUMERIC_TEXT.test(value)) {
      return { value, label: label || value, numeric: fraction ?? Number(value), kind: 'number' };
    }
    return { value, label: label || value, kind: 'tshirt' };
  });
  const scale = colorize(cards);
  const error = validateScale(scale);
  return error ? { ok: false, error } : { ok: true, scale };
}

export type StatsBasis = 'numeric' | 'ordinal';

export interface ScaleIndex {
  basis: StatsBasis;
  position: Map<string, number>;
  measure: Map<string, number>;
  ordered: Card[];
  special: Set<string>;
}

export function indexScale(scale: readonly Card[]): ScaleIndex {
  const estimable = scale.filter((c) => c.kind !== 'special');
  const basis: StatsBasis = estimable.every((c) => c.kind === 'number') ? 'numeric' : 'ordinal';
  const ordered =
    basis === 'numeric'
      ? [...estimable].sort((a, b) => (a.numeric ?? 0) - (b.numeric ?? 0))
      : [...estimable];
  const position = new Map<string, number>();
  const measure = new Map<string, number>();
  ordered.forEach((c, i) => {
    position.set(c.value, i);
    measure.set(c.value, basis === 'numeric' ? (c.numeric ?? i) : i);
  });
  return {
    basis,
    position,
    measure,
    ordered,
    special: new Set(scale.filter((c) => c.kind === 'special').map((c) => c.value)),
  };
}
