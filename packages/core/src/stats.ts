import { type Card, indexScale, type StatsBasis } from './scales.ts';

export type Consensus = 'full' | 'near' | 'split';

export interface CardCount {
  value: string;
  count: number;
}

export interface Stats {
  total: number;
  estimableCount: number;
  basis: StatsBasis;
  distribution: CardCount[];
  special: CardCount[];
  min: string | null;
  max: string | null;
  median: number | null;
  average: number | null;
  mode: string[];
  spreadSteps: number | null;
  consensus: Consensus | null;
  suggested: string | null;
}

export function consensusFor(spreadSteps: number): Consensus {
  if (spreadSteps === 0) return 'full';
  return spreadSteps <= 1 ? 'near' : 'split';
}

export function computeStats(values: readonly string[], scale: readonly Card[]): Stats {
  const idx = indexScale(scale);
  const counts = new Map<string, number>();
  for (const v of values) {
    if (idx.position.has(v) || idx.special.has(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const distribution = idx.ordered.map((c) => ({
    value: c.value,
    count: counts.get(c.value) ?? 0,
  }));
  const special = scale
    .filter((c) => c.kind === 'special')
    .map((c) => ({ value: c.value, count: counts.get(c.value) ?? 0 }));

  const measures: number[] = [];
  for (const d of distribution) {
    const m = idx.measure.get(d.value) ?? 0;
    for (let i = 0; i < d.count; i++) measures.push(m);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const base = {
    total,
    estimableCount: measures.length,
    basis: idx.basis,
    distribution,
    special,
  };
  if (measures.length === 0) {
    return {
      ...base,
      min: null,
      max: null,
      median: null,
      average: null,
      mode: [],
      spreadSteps: null,
      consensus: null,
      suggested: null,
    };
  }

  const present = distribution.filter((d) => d.count > 0);
  const minCard = present[0]?.value ?? null;
  const maxCard = present[present.length - 1]?.value ?? null;
  const mid = measures.length >> 1;
  const median =
    measures.length % 2 === 1
      ? (measures[mid] ?? 0)
      : ((measures[mid - 1] ?? 0) + (measures[mid] ?? 0)) / 2;
  const average = measures.reduce((a, b) => a + b, 0) / measures.length;
  const top = Math.max(...present.map((d) => d.count));
  const spreadSteps =
    (idx.position.get(maxCard ?? '') ?? 0) - (idx.position.get(minCard ?? '') ?? 0);

  let suggested: string | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const c of idx.ordered) {
    const d = Math.abs((idx.measure.get(c.value) ?? 0) - median);
    if (d <= best) {
      best = d;
      suggested = c.value;
    }
  }

  return {
    ...base,
    min: minCard,
    max: maxCard,
    median,
    average,
    mode: present.filter((d) => d.count === top).map((d) => d.value),
    spreadSteps,
    consensus: consensusFor(spreadSteps),
    suggested,
  };
}
