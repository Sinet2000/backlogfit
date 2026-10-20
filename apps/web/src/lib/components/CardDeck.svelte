<script lang="ts">
import type { Card as CardT } from '@backlogfit/core';
import { cardName } from '../cards.ts';
import Card from './Card.svelte';

interface Props {
  cards: readonly CardT[];
  selected: string | null;
  disabled?: boolean;
  label?: string;
  onpick: (value: string | null) => void;
}
let { cards, selected, disabled = false, label = 'Your estimate', onpick }: Props = $props();

let buttons: HTMLButtonElement[] = $state([]);
let focusIndex = $state(-1);
const tabIndexFor = (i: number) => {
  const sel = cards.findIndex((c) => c.value === selected);
  const active = focusIndex >= 0 ? focusIndex : sel >= 0 ? sel : 0;
  return i === active ? 0 : -1;
};

function pick(value: string) {
  if (disabled) return;
  onpick(selected === value ? null : value);
}

/**
 * Arrow keys move focus between cards; Space/Enter (or click) picks. Picking is not tied to
 * arrow movement so browsing the deck never casts (or auto-reveals) a vote by accident.
 */
function onkeydown(e: KeyboardEvent, i: number) {
  const last = cards.length - 1;
  let next = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i === last ? 0 : i + 1;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i === 0 ? last : i - 1;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = last;
  if (next < 0) return;
  e.preventDefault();
  focusIndex = next;
  buttons[next]?.focus();
}
</script>

<div class="deck" role="radiogroup" aria-label={label} aria-disabled={disabled || undefined}>
  {#each cards as card, i (card.value)}
    <button
      bind:this={buttons[i]}
      type="button"
      role="radio"
      class="slot"
      aria-checked={selected === card.value}
      aria-label={cardName(card)}
      aria-disabled={disabled || undefined}
      aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
      tabindex={tabIndexFor(i)}
      data-testid="card"
      data-value={card.value}
      onclick={() => pick(card.value)}
      onkeydown={(e) => onkeydown(e, i)}
      onfocus={() => (focusIndex = i)}
    >
      <Card {card} selected={selected === card.value} size="md" />
      {#if i < 9}<span class="key" aria-hidden="true">{i + 1}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .deck {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-3);
  }

  .slot {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1);
    border: 0;
    border-radius: var(--radius-lg);
    background: none;
    cursor: pointer;
    transition: transform var(--duration-fast) var(--ease-out);
  }

  .slot:hover:not([aria-disabled='true']) {
    transform: translateY(-4px);
  }

  .slot[aria-checked='true'] {
    transform: translateY(-8px);
  }

  .slot[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .key {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 480px) {
    .deck {
      gap: var(--space-2);
    }

    .slot :global(.card) {
      --w: 58px;
      --h: 82px;
    }

    .key {
      display: none;
    }
  }

  @media (hover: none) {
    .key {
      display: none;
    }
  }
</style>
