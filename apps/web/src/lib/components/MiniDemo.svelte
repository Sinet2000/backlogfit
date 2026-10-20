<script lang="ts">
  import { computeStats, presetScale } from '@backlogfit/core';
  import { onMount } from 'svelte';
  import { consensusText } from '../room/format.ts';
  import Button from './Button.svelte';
  import Card from './Card.svelte';
  import Icon from './Icon.svelte';

  // A static, local illustration of a reveal (no network). Rendered client-side only because
  // card colors are applied through CSSOM, which prerendered HTML must not contain.
  const scale = presetScale('fibonacci');
  const ROUNDS = [
    ['5', '5', '8', '5'],
    ['3', '5', '5', '5'],
    ['2', '8', '13', '3'],
  ];
  const NAMES = ['Ada', 'Grace', 'Linus', 'You'];

  let mounted = $state(false);
  let revealed = $state(false);
  let roundIndex = $state(0);
  onMount(() => (mounted = true));

  const votes = $derived(ROUNDS[roundIndex % ROUNDS.length] ?? []);
  const stats = $derived(computeStats(votes, scale));
  const consensus = $derived(stats.consensus ? consensusText(stats.consensus) : null);
  const card = (v: string) => scale.find((c) => c.value === v) ?? scale[0];

  function toggle() {
    if (revealed) roundIndex++;
    revealed = !revealed;
  }
</script>

<div class="mini panel" aria-label="Example of a vote reveal" role="group">
  <div class="top">
    <span class="key">DEMO-42</span>
    <span class="title">Customer can download statements as PDF</span>
  </div>
  <div class="cards">
    {#if mounted}
      {#each votes as v, i (i)}
        {@const c = card(v)}
        {#if c}<Card card={c} faceUp={revealed} size="md" caption={NAMES[i] ?? ""} />{/if}
      {/each}
    {:else}
      <div class="placeholder" aria-hidden="true"></div>
    {/if}
  </div>
  <p class="result" aria-live="polite">
    {#if revealed && consensus && stats.consensus}
      <Icon name={consensus.icon} size={18} />
      <span><strong>{consensus.title}</strong> Median {stats.median}.</span>
    {:else}
      <Icon name="users" size={18} /> <span>4 of 4 voted. Nobody sees a card until the reveal.</span>
    {/if}
  </p>
  <Button variant={revealed ? 'secondary' : 'primary'} icon={revealed ? 'refresh' : 'eye'} onclick={toggle}>
    {revealed ? 'Try another round' : 'Reveal the votes'}
  </Button>
</div>

<style>
  .mini {
    display: grid;
    justify-items: center;
    gap: var(--space-5);
    padding: var(--space-6);
    box-shadow: var(--shadow-lg);
  }

  .top {
    justify-self: stretch;
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    font-size: var(--text-sm);
  }

  .key {
    font-family: var(--font-mono);
    padding: 1px var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
  }

  .title {
    font-weight: var(--weight-semibold);
  }

  .cards {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-4);
    min-height: 132px;
  }

  .placeholder {
    width: 336px;
    height: 132px;
  }

  .result {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 28px;
    font-size: var(--text-sm);
    text-align: center;
  }
</style>
