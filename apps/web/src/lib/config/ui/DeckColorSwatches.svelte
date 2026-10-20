<script lang="ts">
  import type { Card } from '@backlogfit/core';
  import { cardName, deckTones } from '../../cards.ts';
  import Button from '../../components/Button.svelte';
  import { CARD_PALETTES, contrastRatio, PALETTES } from '../../styles/palette.ts';
  import { setColor } from '../chips.ts';

  interface Props {
    deck: Card[];
    onchange: (deck: Card[]) => void;
    onreset: () => void;
  }
  let { deck, onchange, onreset }: Props = $props();

  const tones = $derived(deckTones(deck));
  const ramp = CARD_PALETTES.corporate.light.steps;
  const estimable = $derived(
    deck
      .map((c, i) => {
        const tone = tones.get(c.value);
        const shown = tone?.custom ?? ramp[(tone?.step ?? 1) - 1]?.bar ?? c.color;
        return { c, i, shown, custom: !!tone?.custom };
      })
      .filter(({ c }) => c.kind !== 'special'),
  );
  const custom = $derived(estimable.some((e) => e.custom));
  const faint = $derived(
    estimable
      .filter((e) => e.custom && contrastRatio(e.shown, PALETTES.corporate.light.surface) < 3)
      .map((e) => e.c.value),
  );
</script>

<div class="swatches-wrap">
  <p class="field-hint">
    By default each theme colors the cards from low to high. A color you pick here is shown to
    everyone as a stripe on that card.
  </p>
  <div class="swatches">
    {#each estimable as { c, i, shown } (c.value)}
      <label class="sw">
        <input type="color" value={shown} oninput={(e) => onchange(setColor(deck, i, e.currentTarget.value))} aria-label="Color of card {cardName(c)}" />
        <span>{c.value}</span>
      </label>
    {/each}
  </div>
  {#if faint.length > 0}
    <p class="warn" role="status">Hard to see on white: {faint.join(', ')}. Pick a darker color.</p>
  {/if}
  {#if custom}
    <div><Button size="sm" variant="ghost" icon="refresh" onclick={onreset}>Use automatic colors</Button></div>
  {/if}
</div>

<style>
  .swatches-wrap {
    display: grid;
    gap: var(--space-3);
    padding-top: var(--space-3);
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .sw {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }

  .sw input {
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
  }

  .warn {
    font-size: var(--text-sm);
    color: var(--color-warning);
  }
</style>
