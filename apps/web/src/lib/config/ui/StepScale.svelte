<script lang="ts">
  import Button from '../../components/Button.svelte';
  import type { SessionWizard } from '../wizard.svelte.ts';
  import { SCALE_CHOICES } from '../wizard.ts';
  import ChipEditor from './ChipEditor.svelte';
  import DeckColorSwatches from './DeckColorSwatches.svelte';

  let { wizard }: { wizard: SessionWizard } = $props();
  let fileInput: HTMLInputElement | undefined = $state();

  async function onfile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await wizard.importPreset(file);
    input.value = '';
  }
</script>

<fieldset class="group">
  <legend class="visually-hidden">Estimation scale</legend>
  <div class="intro">
    <p class="muted">Pick the cards people vote with. The value is always printed on the card.</p>
    <Button variant="link" icon="upload" onclick={() => fileInput?.click()} data-testid="preset-import">
      Use settings from a file…
    </Button>
    <input bind:this={fileInput} type="file" accept="application/json,.json" class="visually-hidden" tabindex="-1" aria-hidden="true" onchange={onfile} data-testid="preset-file" />
  </div>
  <div class="choices">
    {#each SCALE_CHOICES as c (c.id)}
      <label class="choice" class:on={wizard.draft.scaleChoice === c.id} data-testid="scale-preset-{c.id}">
        <input type="radio" name="scale" value={c.id} checked={wizard.draft.scaleChoice === c.id} onchange={() => wizard.chooseScale(c.id)} />
        <span class="choice-text"><span class="choice-name">{c.name}</span><span class="field-hint">{c.hint}</span></span>
      </label>
    {/each}
  </div>
</fieldset>

{#if wizard.draft.scaleChoice === 'custom'}
  <ChipEditor
    deck={wizard.draft.scale}
    from={wizard.customFrom}
    error={wizard.showErrors ? (wizard.errors.scale ?? null) : null}
    onchange={(d) => (wizard.draft.scale = d)}
    onclear={() => wizard.clearDeck()}
  />
{:else}
  <details class="disclosure">
    <summary>Edit card colors</summary>
    <DeckColorSwatches
      deck={wizard.draft.scale}
      onchange={(d) => (wizard.draft.scale = d)}
      onreset={() => wizard.chooseScale(wizard.draft.scaleChoice)}
    />
  </details>
{/if}

<style>
  .group {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .intro {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
  }

  .choices {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }

  .choice {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    cursor: pointer;
  }

  .choice:hover {
    background: var(--color-surface-2);
  }

  .choice.on {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
    box-shadow: inset 0 0 0 1px var(--color-accent);
  }

  .choice input {
    width: 20px;
    height: 20px;
    margin: 2px 0 0;
    accent-color: var(--color-accent);
    flex: none;
  }

  .choice-text {
    display: grid;
    gap: 2px;
  }

  .choice-name {
    font-weight: var(--weight-semibold);
  }
</style>
