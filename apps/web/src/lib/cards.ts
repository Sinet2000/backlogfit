import { type Card, contrastText } from '@backlogfit/core';

/** Accessible names for the special cards (the visible face shows the symbol). */
export const SPECIAL_NAMES: Record<string, string> = {
  '?': 'Unclear',
  '☕': 'Coffee break',
  '∞': 'Too big, split it',
};

export function cardName(card: Pick<Card, 'value' | 'label' | 'kind'>): string {
  if (card.kind === 'special') return SPECIAL_NAMES[card.value] ?? card.label;
  return card.label === card.value ? card.value : `${card.value}, ${card.label}`;
}

export function cardFor(scale: readonly Card[], value: string): Card | undefined {
  return scale.find((c) => c.value === value);
}

export const inkFor = (color: string) => contrastText(color);
