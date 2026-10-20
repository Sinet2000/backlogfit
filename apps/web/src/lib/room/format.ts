import type { Card, Stats, VoteView } from '@backlogfit/core';
import type { IconName } from '../components/Icon.svelte';

/** Median or average: a card value for ordinal (t-shirt) decks, a rounded number otherwise. */
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
        title: 'Votes differ.',
        detail: 'Ask the highest and lowest voter why, then vote again.',
        icon: 'split',
      };
  }
}

/** "QA is estimating this task." / "Dev and QA are estimating this task." */
export function estimatingText(names: readonly string[]): string {
  if (names.length === 0) return 'Another team is estimating this task.';
  const who =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${who} ${names.length === 1 ? 'is' : 'are'} estimating this task.`;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface VoteGroup {
  value: string;
  votes: VoteView[];
}

/** Votes grouped by value, lowest first; special cards and unknown values go last. */
export function groupVotes(votes: readonly VoteView[], scale: readonly Card[]): VoteGroup[] {
  const order = new Map(scale.map((c, i) => [c.value, c.kind === 'special' ? 1e6 + i : i]));
  const groups = new Map<string, VoteView[]>();
  for (const v of votes) groups.set(v.value, [...(groups.get(v.value) ?? []), v]);
  return [...groups]
    .map(([value, vs]) => ({ value, votes: vs }))
    .sort((a, b) => (order.get(a.value) ?? 1e9) - (order.get(b.value) ?? 1e9));
}

export function formatEndTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatRemaining(ms: number): string {
  if (ms < 60_000) return 'less than a minute';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}
