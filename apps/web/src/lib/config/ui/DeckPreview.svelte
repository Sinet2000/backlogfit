<script lang="ts">
  import type { Card as CardT } from '@backlogfit/core';
  import { deckTones, NO_TONE } from '../../cards.ts';
  import Card from '../../components/Card.svelte';

  let { deck, error }: { deck: readonly CardT[]; error: string | null } = $props();
  const tones = $derived(deckTones(deck));
</script>

<aside class="preview panel" aria-label="Preview of the deck">
  <h2>Your deck</h2>
  {#if deck.length > 0}
    <div class="cards">
      {#each deck as card (card.value)}
        <Card {card} tone={tones.get(card.value) ?? NO_TONE} size="sm" />
      {/each}
    </div>
  {:else}
    <p class="muted small">No cards yet.</p>
  {/if}
  {#if error}<p class="form-error">{error}</p>{/if}
  <p class="muted small">The value is always printed on the card, so color is never the only signal.</p>
</aside>

<style>
  .preview {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
  }

  @media (min-width: 960px) {
    .preview {
      position: sticky;
      top: calc(var(--header-height) + var(--space-6));
    }
  }

  h2 {
    font-size: var(--text-md);
  }

  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .small {
    font-size: var(--text-sm);
  }
</style>
