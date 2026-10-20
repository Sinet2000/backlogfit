import type { Stats } from '@backlogfit/core';
import type { IconName } from '../components/Icon.svelte';

/** Median/average as a scale value for ordinal (t-shirt) decks, rounded number otherwise. */
export function formatStat(stats: Stats, key: 'median' | 'average'): string {
  const n = stats[key];
  if (n === null) return '–';
  if (stats.basis === 'ordinal') return stats.distribution[Math.round(n)]?.value ?? '–';
  return String(Math.round(n * 10) / 10);
}

export function consensusText(level: 'full' | 'near' | 'split'): {
  title: string;
  detail: string;
  icon: IconName;
} {
  switch (level) {
    case 'full':
      return { title: 'Full agreement.', detail: 'Everyone picked the same card.', icon: 'equal' };
    case 'near':
      return { title: 'Close.', detail: 'All votes are within one step.', icon: 'approx' };
    case 'split':
      return {
        title: 'Split.',
        detail: 'Ask the highest and lowest voters to explain, then vote again.',
        icon: 'split',
      };
  }
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "1 h 20 min" style remaining time for session expiry. */
export function formatRemaining(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 1) return 'less than a minute';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}
