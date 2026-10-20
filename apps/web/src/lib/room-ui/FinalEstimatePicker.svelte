<script lang="ts">
  import type { Card as CardT } from '@backlogfit/core';
  import { cardName, deckTones, NO_TONE } from '../cards.ts';
  import Card from '../components/Card.svelte';

  interface Props {
    scale: readonly CardT[];
    suggested: string | null;
    taskLabel: string;
    choice: string | null;
    custom: string;
  }
  let { scale, suggested, taskLabel, choice = $bindable(), custom = $bindable() }: Props = $props();

  const estimable = $derived(scale.filter((c) => c.kind !== 'special'));
  const tones = $derived(deckTones(scale));
  const usingCustom = $derived(custom.trim() !== '');
</script>

<fieldset class="final">
  <legend>Final estimate for {taskLabel}</legend>
  <div class="picks" role="radiogroup" aria-label="Final estimate">
    {#each estimable as c (c.value)}
      <button
        type="button"
        role="radio"
        class="pick"
        aria-checked={choice === c.value && !usingCustom}
        aria-label="{cardName(c)}{suggested === c.value ? ', suggested' : ''}"
        data-testid="final-value"
        data-value={c.value}
        onclick={() => {
          choice = c.value;
          custom = '';
        }}
      >
        <span class="chip" class:shown={suggested === c.value} aria-hidden="true">Suggested</span>
        <Card card={c} tone={tones.get(c.value) ?? NO_TONE} size="sm" selected={choice === c.value && !usingCustom} />
      </button>
    {/each}
  </div>
  <div class="custom">
    <label class="field-label" for="final-custom">Custom value</label>
    <input
      id="final-custom"
      class="input"
      bind:value={custom}
      maxlength="16"
      placeholder="For example 6"
      autocomplete="off"
      data-testid="final-custom"
    />
  </div>
</fieldset>

<style>
  .final {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: var(--space-2);
    font-weight: var(--weight-semibold);
  }

  .picks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .pick {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    padding: var(--space-1);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    cursor: pointer;
  }

  .pick:hover :global(.front) {
    box-shadow: var(--shadow-md);
  }

  .chip {
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    line-height: 20px;
    visibility: hidden;
  }

  .chip.shown {
    visibility: visible;
  }

  :global(:root[data-mode='contrast']) .chip {
    border: 1px solid var(--color-border);
  }

  .custom {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .custom .field-label {
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  .custom .input {
    max-width: 10rem;
  }
</style>
