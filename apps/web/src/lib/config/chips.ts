/** Pure helpers behind the ChipEditor (custom deck editing). */
import {
  type Card,
  type CardKind,
  colorize,
  SPECIAL_COFFEE,
  SPECIAL_INFINITY,
  SPECIAL_UNSURE,
} from '@backlogfit/core';

const SPECIAL_SET = new Set<string>([SPECIAL_UNSURE, SPECIAL_COFFEE, SPECIAL_INFINITY]);
const SPECIAL_LABELS: Record<string, string> = {
  [SPECIAL_UNSURE]: 'Unsure',
  [SPECIAL_COFFEE]: 'Break',
  [SPECIAL_INFINITY]: 'Too big',
};
const NUMERIC = /^-?\d{1,6}(\.\d{1,3})?$/;
const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };

/** Same kind inference as core's buildCustomScale, for a single card (no scale validation). */
export function cardFromValue(raw: string): Omit<Card, 'color'> | null {
  const value = raw.normalize('NFC').trim();
  if (value === '' || value.length > 8) return null;
  if (SPECIAL_SET.has(value))
    return { value, label: SPECIAL_LABELS[value] ?? value, kind: 'special' };
  const fraction = FRACTIONS[value];
  if (fraction !== undefined || NUMERIC.test(value)) {
    return { value, label: value, numeric: fraction ?? Number(value), kind: 'number' };
  }
  return { value, label: value, kind: 'tshirt' as CardKind };
}

export function splitValues(text: string): string[] {
  return text
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** Append values (skipping duplicates and invalid ones). Returns the new deck and what was skipped. */
export function addValues(
  deck: readonly Card[],
  text: string,
  autoColors: boolean,
): { deck: Card[]; skipped: string[] } {
  const existing = new Set(deck.map((c) => c.value));
  const added: Card[] = [];
  const skipped: string[] = [];
  for (const v of splitValues(text)) {
    const c = cardFromValue(v);
    if (!c || existing.has(c.value)) {
      skipped.push(v);
      continue;
    }
    existing.add(c.value);
    added.push({ ...c, color: '#8b8f97' });
  }
  const next = [...deck, ...added];
  return { deck: autoColors ? autoColor(next) : fillColors(next, added), skipped };
}

function fillColors(deck: Card[], added: Card[]): Card[] {
  const auto = autoColor(deck);
  const addedSet = new Set(added.map((c) => c.value));
  return deck.map((c, i) =>
    addedSet.has(c.value) ? { ...c, color: auto[i]?.color ?? c.color } : c,
  );
}

export function autoColor(deck: readonly Card[]): Card[] {
  return colorize(deck.map(({ color: _c, ...rest }) => rest));
}

export function move(deck: readonly Card[], from: number, to: number): Card[] {
  if (from === to || from < 0 || from >= deck.length) return [...deck];
  const next = [...deck];
  const [item] = next.splice(from, 1);
  if (item) next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

export function removeAt(deck: readonly Card[], index: number): Card[] {
  return deck.filter((_, i) => i !== index);
}

export function setColor(deck: readonly Card[], index: number, color: string): Card[] {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return [...deck];
  return deck.map((c, i) => (i === index ? { ...c, color: color.toLowerCase() } : c));
}
