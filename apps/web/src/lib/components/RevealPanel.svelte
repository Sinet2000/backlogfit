<script lang="ts">
  import type { Card as CardT, RoundView } from '@backlogfit/core';
  import { onMount } from 'svelte';
  import { cardFor, cardName } from '../cards.ts';
  import { consensusText, formatStat } from '../room/format.ts';
  import Card from './Card.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    round: RoundView;
    scale: readonly CardT[];
    /** Flip the cards in on first show (disabled by prefers-reduced-motion via tokens). */
    animate?: boolean;
  }
  let { round, scale, animate = true }: Props = $props();

  let faceUp = $state(false);
  onMount(() => {
    if (!animate) {
      faceUp = true;
      return;
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => (faceUp = true)));
    return () => cancelAnimationFrame(id);
  });

  const stats = $derived(round.stats);
  const votes = $derived(round.votes ?? []);
  const fallback = (value: string): CardT =>
    cardFor(scale, value) ?? { value, label: value, kind: 'special', color: '#8b8f97' };
  const maxCount = $derived(
    Math.max(
      1,
      ...(stats?.distribution.map((d) => d.count) ?? [1]),
      ...(stats?.special.map((d) => d.count) ?? [1]),
    ),
  );
  const consensus = $derived(stats?.consensus ? consensusText(stats.consensus) : null);
  const specials = $derived(stats?.special.filter((s) => s.count > 0) ?? []);
</script>

<section class="reveal" data-testid="reveal-results" aria-labelledby="reveal-h">
  <h2 id="reveal-h" class="visually-hidden">Results of round {round.n}</h2>

  {#if consensus && stats?.consensus}
    <p class="consensus {stats.consensus}" data-testid="consensus" data-level={stats.consensus}>
      <Icon name={consensus.icon} size={22} />
      <span><strong>{consensus.title}</strong> <span class="why">{consensus.detail}</span></span>
    </p>
  {:else}
    <p class="consensus none" data-testid="consensus" data-level="none">
      <Icon name="info" size={22} />
      <span><strong>No estimates to compare.</strong></span>
    </p>
  {/if}

  <ul class="cards" aria-label="Votes">
    {#each votes as v, i (v.participantId ?? `anon-${i}`)}
      <li
        data-testid="reveal-card"
        data-name={round.anonymous ? '' : (v.name ?? '')}
        data-value={v.value}
        aria-label="{round.anonymous ? 'Anonymous' : v.name}: {cardName(fallback(v.value))}"
      >
        <Card card={fallback(v.value)} {faceUp} caption={round.anonymous ? '' : (v.name ?? '')} />
      </li>
    {:else}
      <li class="empty muted">Nobody voted in this round.</li>
    {/each}
  </ul>

  {#if stats && stats.total > 0}
    <div class="grid">
      <dl class="stats">
        <div>
          <dt>Median</dt>
          <dd data-testid="stat-median">{formatStat(stats, 'median')}</dd>
        </div>
        <div>
          <dt>Most common</dt>
          <dd data-testid="stat-mode">{stats.mode.length ? stats.mode.join(', ') : '–'}</dd>
        </div>
        <div>
          <dt>Average</dt>
          <dd data-testid="stat-average">{formatStat(stats, 'average')}</dd>
        </div>
        <div>
          <dt>Range</dt>
          <dd data-testid="stat-range">
            {stats.min === null ? '–' : stats.min === stats.max ? stats.min : `${stats.min} – ${stats.max}`}
          </dd>
        </div>
      </dl>

      <div class="dist">
        <h3 class="dist-h">Distribution</h3>
        <ul class="bars">
          {#each stats.distribution.filter((d) => d.count > 0) as d (d.value)}
            {@const c = fallback(d.value)}
            <li>
              <span class="bar-label">{d.value}</span>
              <span class="track" aria-hidden="true">
                <span class="fill" style:--pct="{(d.count / maxCount) * 100}%" style:--card-color={c.color}></span>
              </span>
              <span class="bar-count">{d.count} {d.count === 1 ? 'vote' : 'votes'}</span>
            </li>
          {/each}
          {#each specials as s (s.value)}
            <li class="special">
              <span class="bar-label">{s.value}</span>
              <span class="track" aria-hidden="true">
                <span class="fill" style:--pct="{(s.count / maxCount) * 100}%"></span>
              </span>
              <span class="bar-count">{s.count} × {cardName(fallback(s.value))}</span>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</section>

<style>
  .reveal {
    display: grid;
    gap: var(--space-6);
  }

  .consensus {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid transparent;
  }

  .consensus.full {
    background: var(--color-success-soft);
    color: var(--color-text);
    border-color: var(--color-success);
  }

  .consensus.full :global(.icon) {
    color: var(--color-success);
  }

  .consensus.near {
    background: var(--color-accent-soft);
    border-color: var(--color-accent);
  }

  .consensus.near :global(.icon) {
    color: var(--color-accent);
  }

  .consensus.split,
  .consensus.none {
    background: var(--color-warning-soft);
    border-color: var(--color-warning);
  }

  .consensus.split :global(.icon) {
    color: var(--color-warning);
  }

  .why {
    color: var(--color-text-muted);
  }

  .cards {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-4);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .cards li:nth-child(2) :global(.inner) {
    transition-delay: 40ms;
  }

  .cards li:nth-child(3) :global(.inner) {
    transition-delay: 80ms;
  }

  .cards li:nth-child(n + 4) :global(.inner) {
    transition-delay: 120ms;
  }

  .grid {
    display: grid;
    gap: var(--space-6);
    grid-template-columns: 1fr;
  }

  @media (min-width: 720px) {
    .grid {
      grid-template-columns: minmax(220px, 1fr) 2fr;
    }
  }

  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin: 0;
  }

  .stats div {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }

  dt {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  dd {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--weight-semibold);
    font-variant-numeric: tabular-nums;
  }

  .dist-h {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-weight: var(--weight-medium);
    margin-bottom: var(--space-2);
  }

  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }

  .bars li {
    display: grid;
    grid-template-columns: 3ch 1fr auto;
    align-items: center;
    gap: var(--space-3);
  }

  .bar-label {
    font-weight: var(--weight-semibold);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .track {
    height: 14px;
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    width: var(--pct);
    min-width: 6px;
    border-radius: var(--radius-full);
    background: var(--card-color, var(--color-border-strong));
  }

  .bar-count {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  @media print {
    .cards {
      justify-content: flex-start;
    }
  }
</style>
