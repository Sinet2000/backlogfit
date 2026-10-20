<script lang="ts">
  import { type Card, SPECIAL_COFFEE, type Stats } from '@backlogfit/core';
  import { cardFor, cardName, deckTones } from '../cards.ts';
  import Icon from './Icon.svelte';

  let { stats, scale }: { stats: Stats; scale: readonly Card[] } = $props();

  const tones = $derived(deckTones(scale));
  const rows = $derived([
    ...stats.distribution.filter((d) => d.count > 0).map((d) => ({ ...d, special: false })),
    ...stats.special.filter((d) => d.count > 0).map((d) => ({ ...d, special: true })),
  ]);
  const max = $derived(Math.max(1, ...rows.map((r) => r.count)));
  const name = (value: string) => {
    const c = cardFor(scale, value);
    return c ? cardName(c) : value;
  };
</script>

<div class="dist">
  <h3>Distribution</h3>
  <ul>
    {#each rows as r (r.value)}
      {@const tone = tones.get(r.value)}
      <li>
        <span class="label" title={name(r.value)}>
          {#if r.value === SPECIAL_COFFEE}<Icon name="cup" size={18} label={name(r.value)} />{:else}{r.value}{/if}
        </span>
        <span class="track" aria-hidden="true">
          <span
            class="fill"
            class:special={r.special}
            class:custom={!!tone?.custom}
            data-step={r.special ? undefined : (tone?.step ?? undefined)}
            style:--pct="{(r.count / max) * 100}%"
            style:--card-custom={tone?.custom ?? undefined}
          ></span>
        </span>
        <span class="count">{r.count} {r.count === 1 ? 'vote' : 'votes'}{r.special ? ` · ${name(r.value)}` : ''}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  h3 {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-weight: var(--weight-medium);
    margin-bottom: var(--space-2);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }

  li {
    display: grid;
    grid-template-columns: 3ch minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-3);
  }

  .label {
    display: grid;
    justify-items: end;
    font-weight: var(--weight-semibold);
    font-variant-numeric: tabular-nums;
  }

  .track {
    display: block;
    height: 14px;
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    overflow: hidden;
  }

  .fill {
    --bar: var(--step-bar, var(--color-border-strong));
    display: block;
    width: var(--pct);
    min-width: 6px;
    height: 100%;
    border-radius: var(--radius-full);
    background: var(--bar);
  }

  .fill.custom {
    --bar: var(--card-custom);
  }

  .fill.special {
    --bar: var(--card-special-edge);
  }


  .count {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  :global(:root[data-mode='contrast']) .track {
    background: #ffffff;
    border: 1px solid #000000;
  }

  @media (prefers-contrast: more) {
    :global(:root:not([data-mode])) .track {
      background: #ffffff;
      border: 1px solid #000000;
    }
  }

  @media (forced-colors: active) {
    .track {
      border: 1px solid CanvasText;
    }

    .fill {
      background: CanvasText;
    }
  }
</style>
