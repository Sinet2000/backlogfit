import { type Card, type CardKind, colorize, NEUTRAL_CARD_COLOR } from '@backlogfit/core';
import { SPECIAL_CARDS, SPECIAL_NAMES } from '../cards.ts';

const SPECIAL_SET = new Set<string>(SPECIAL_CARDS);
const NUMERIC = /^-?\d{1,6}(\.\d{1,3})?$/;
const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };

/** Infers a card's kind like core's buildCustomScale does, without validating the deck. */
export function cardFromValue(raw: string): Omit<Card, 'color'> | null {
  const value = raw.normalize('NFC').trim();
  if (value === '' || value.length > 8) return null;
  if (SPECIAL_SET.has(value))
    return { value, label: SPECIAL_NAMES[value] ?? value, kind: 'special' };
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

/** Appends values, skipping duplicates and invalid ones, and reports what was skipped. */
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
    added.push({ ...c, color: NEUTRAL_CARD_COLOR });
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

/** Re-applies automatic colors after an edit, keeping the cards whose color the host picked. */
export function keepCustomColors(before: readonly Card[], after: readonly Card[]): Card[] {
  const auto = autoColor(before);
  const picked = new Set(
    before
      .filter((c, i) => c.color.toLowerCase() !== auto[i]?.color.toLowerCase())
      .map((c) => c.value),
  );
  const next = autoColor(after);
  return after.map((c, i) =>
    picked.has(c.value) ? c : { ...c, color: next[i]?.color ?? c.color },
  );
}
