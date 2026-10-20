import {
  type Card,
  colorize,
  SPECIAL_COFFEE,
  SPECIAL_INFINITY,
  SPECIAL_UNSURE,
} from '@backlogfit/core';
import { CARD_STEPS } from './styles/palette.ts';

export const SPECIAL_NAMES: Record<string, string> = {
  [SPECIAL_UNSURE]: 'Not sure',
  [SPECIAL_COFFEE]: 'Break',
  [SPECIAL_INFINITY]: 'Too big',
};

export const SPECIAL_CARDS = [SPECIAL_UNSURE, SPECIAL_COFFEE, SPECIAL_INFINITY] as const;

export function cardName(card: Pick<Card, 'value' | 'label' | 'kind'>): string {
  if (card.kind === 'special') return SPECIAL_NAMES[card.value] ?? card.label;
  return card.label === card.value ? card.value : `${card.value}, ${card.label}`;
}

export function cardFor(scale: readonly Card[], value: string): Card | undefined {
  return scale.find((c) => c.value === value);
}

/** How a card is coloured: a step of the theme's ramp, or the host's own colour. */
export interface CardTone {
  step: number | null;
  custom: string | null;
}

export const NO_TONE: CardTone = { step: null, custom: null };

export function rampStep(rank: number, count: number): number {
  if (count <= 1) return Math.ceil(CARD_STEPS / 2);
  return Math.round((rank * (CARD_STEPS - 1)) / (count - 1)) + 1;
}

/**
 * Tones for a deck, keyed by value. Estimable cards get a ramp step from their rank, so the theme
 * decides the colours; a colour the host picked (anything other than the automatic one) is kept.
 */
export function deckTones(scale: readonly Card[]): Map<string, CardTone> {
  const auto = colorize(scale.map(({ color: _c, ...rest }) => rest));
  const estimable = scale.filter((c) => c.kind !== 'special').length;
  const out = new Map<string, CardTone>();
  let rank = 0;
  scale.forEach((card, i) => {
    if (card.kind === 'special') {
      out.set(card.value, NO_TONE);
      return;
    }
    const picked = card.color.toLowerCase() !== auto[i]?.color.toLowerCase();
    out.set(card.value, {
      step: rampStep(rank++, estimable),
      custom: picked ? card.color : null,
    });
  });
  return out;
}

export function hasCustomColors(scale: readonly Card[]): boolean {
  return [...deckTones(scale).values()].some((t) => t.custom !== null);
}
