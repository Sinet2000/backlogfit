<script lang="ts">
  import type { Card as CardT, RoundView, Team } from '@backlogfit/core';
  import { onMount } from 'svelte';
  import { cardFor, cardName, deckTones, NO_TONE } from '../cards.ts';
  import { consensusText, formatStat, groupVotes } from '../room/format.ts';
  import Card from './Card.svelte';
  import DistributionBars from './DistributionBars.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    round: RoundView;
    scale: readonly CardT[];
    animate?: boolean;
    teams?: readonly Team[];
  }
  let { round, scale, animate = true, teams = [] }: Props = $props();
  const teamName = (id: string | null) =>
    id === null ? 'No team' : (teams.find((t) => t.id === id)?.name ?? 'No team');

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
  const tones = $derived(deckTones(scale));
  const groups = $derived(groupVotes(round.votes ?? [], scale));
  const consensus = $derived(stats?.consensus ? consensusText(stats.consensus) : null);
  const agreed = $derived(stats?.consensus === 'full' && stats.min !== null ? stats.min : null);
  const range = $derived(
    !stats || stats.min === null
      ? '–'
      : stats.min === stats.max
        ? stats.min
        : `${stats.min} – ${stats.max}`,
  );
  const fallback = (value: string): CardT =>
    cardFor(scale, value) ?? { value, label: value, kind: 'special', color: '#8b8f97' };
</script>

<section class="reveal" data-testid="reveal-results" aria-labelledby="reveal-h">
  <h2 id="reveal-h" class="visually-hidden">Results of round {round.n}</h2>

  {#if agreed !== null}
    <p class="consensus full" data-testid="consensus" data-level="full">
      <Icon name="equal" size={22} />
      <span><strong>Everyone voted {agreed}.</strong></span>
    </p>
  {:else if consensus && stats?.consensus}
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

  <ul class="cards" aria-label="Votes, lowest first">
    {#each groups as g (g.value)}
      {@const card = fallback(g.value)}
      <li class="group" class:stack={g.votes.length > 1} data-testid="reveal-group" data-value={g.value}>
        <span class="card-wrap">
          <Card {card} tone={tones.get(g.value) ?? NO_TONE} {faceUp} />
          {#if g.votes.length > 1}<span class="count" aria-hidden="true">×{g.votes.length}</span>{/if}
        </span>
        <span class="visually-hidden">{cardName(card)}: {g.votes.length} {g.votes.length === 1 ? 'vote' : 'votes'}</span>
        <ul class="names">
          {#each g.votes as v, i (v.participantId ?? `anon-${i}`)}
            <li
              data-testid="reveal-card"
              data-name={round.anonymous ? '' : (v.name ?? '')}
              data-value={v.value}
              class:anon={round.anonymous}
            >
              {round.anonymous ? '' : (v.name ?? '')}
            </li>
          {/each}
        </ul>
      </li>
    {:else}
      <li class="empty muted">Nobody voted in this round.</li>
    {/each}
  </ul>

  {#if round.teams}
    <div class="by-team" data-testid="team-summary">
      <h3 class="by-team-label">By team</h3>
      {#if round.teams.hidden}
        <p class="muted" data-testid="team-summary-hidden">Hidden to keep votes anonymous: a team with one vote would show that person’s vote.</p>
      {:else}
        <ul>
          {#each round.teams.groups as g (g.team ?? '')}
            <li data-testid="team-summary-item" data-team={g.team ?? ''} data-median={g.median ?? ''} data-count={g.count}>
              <span class="team-name">{teamName(g.team)}</span>
              <strong>{g.median ?? '–'}</strong>
              <span class="muted">({g.count} {g.count === 1 ? 'vote' : 'votes'})</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  {#if stats && stats.total > 0 && agreed === null}
    <div class="grid">
      <div class="numbers">
        <dl class="stats">
          <div>
            <dt>Median</dt>
            <dd data-testid="stat-median">{formatStat(stats, 'median')}</dd>
          </div>
          <div>
            <dt>Average</dt>
            <dd data-testid="stat-average">{formatStat(stats, 'average')}</dd>
          </div>
          <div>
            <dt>Range</dt>
            <dd data-testid="stat-range">{range}</dd>
          </div>
        </dl>
        <p class="mode">
          {#if stats.mode.length === 1}
            Most common: <strong data-testid="stat-mode">{stats.mode[0]}</strong>
          {:else}
            <span data-testid="stat-mode">No common vote</span>
          {/if}
        </p>
      </div>
      <DistributionBars {stats} {scale} />
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

  .by-team {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
  }

  .by-team-label {
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .by-team ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .by-team li {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
  }

  .by-team strong {
    font-size: var(--text-base);
    font-variant-numeric: tabular-nums;
  }

  .team-name {
    font-weight: var(--weight-medium);
  }

  .cards {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-6);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .group {
    display: grid;
    align-content: start;
    justify-items: center;
    gap: var(--space-2);
    max-width: 10rem;
  }

  .card-wrap {
    position: relative;
    display: inline-block;
  }

  .stack .card-wrap::before {
    content: '';
    position: absolute;
    inset: 0;
    transform: translate(5px, -5px);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }

  .card-wrap :global(.card) {
    position: relative;
  }

  .count {
    position: absolute;
    top: -12px;
    right: -14px;
    min-width: 28px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-text);
    color: var(--color-surface);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    line-height: 22px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .names {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
    text-align: center;
    font-size: var(--text-sm);
  }

  .names li {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 10rem;
  }

  .names li.anon {
    display: none;
  }

  .cards li.group:nth-child(2) :global(.inner) {
    transition-delay: calc(40ms * var(--lift));
  }

  .cards li.group:nth-child(3) :global(.inner) {
    transition-delay: calc(80ms * var(--lift));
  }

  .cards li.group:nth-child(n + 4) :global(.inner) {
    transition-delay: calc(120ms * var(--lift));
  }

  .grid {
    display: grid;
    gap: var(--space-6);
    grid-template-columns: minmax(0, 1fr);
    padding-top: var(--space-5);
    border-top: 1px solid var(--color-border);
  }

  @media (min-width: 960px) {
    .grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }

  .numbers {
    display: grid;
    gap: var(--space-3);
    align-content: start;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
    white-space: nowrap;
  }

  .mode {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .mode strong {
    color: var(--color-text);
  }

  :global(:root[data-mode='contrast']) .stats div {
    border: 1px solid var(--color-border);
  }

  @media print {
    .cards {
      justify-content: flex-start;
    }
  }
</style>
