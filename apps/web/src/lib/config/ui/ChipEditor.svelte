<script lang="ts">
  import type { Card } from '@backlogfit/core';
  import { cardName, SPECIAL_CARDS, SPECIAL_NAMES } from '../../cards.ts';
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';
  import { addValues, autoColor, keepCustomColors, move, removeAt } from '../chips.ts';
  import type { ScaleChoice } from '../draft.ts';
  import { choiceName } from '../wizard.ts';
  import DeckColorSwatches from './DeckColorSwatches.svelte';

  interface Props {
    deck: Card[];
    from: ScaleChoice | null;
    error: string | null;
    onchange: (deck: Card[]) => void;
    onclear: () => void;
  }
  let { deck, from, error, onchange, onclear }: Props = $props();

  let text = $state('');
  let note = $state('');
  let dragFrom = $state<number | null>(null);
  let dragOver = $state<number | null>(null);
  let chips: HTMLButtonElement[] = $state([]);
  const uid = $props.id();

  function commit(next: Card[], message = '') {
    onchange(keepCustomColors(deck, next));
    note = message;
  }

  function add() {
    if (text.trim() === '') return;
    const { deck: next, skipped } = addValues(deck, text, false);
    text = '';
    commit(
      next,
      skipped.length ? `Skipped: ${skipped.join(', ')} (duplicate or too long).` : 'Cards added.',
    );
  }

  function moveCard(i: number, to: number, focus = false) {
    if (to < 0 || to >= deck.length) return;
    const card = deck[i];
    commit(move(deck, i, to), `Moved ${card?.value} to position ${to + 1} of ${deck.length}.`);
    if (focus) queueMicrotask(() => chips[to]?.focus());
  }

  function remove(i: number) {
    const card = deck[i];
    commit(removeAt(deck, i), `Removed ${card?.value}.`);
  }

  function onchipkey(e: KeyboardEvent, i: number) {
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      moveCard(i, e.key === 'ArrowLeft' ? i - 1 : i + 1, true);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(i);
    }
  }

  function clearAll() {
    onclear();
    note = 'All cards removed.';
  }

  const has = (v: string) => deck.some((c) => c.value === v);
</script>

<div class="chip-editor">
  <div class="source">
    <span class="muted">{from ? `Starting from ${choiceName(from)}` : 'Your own deck'}</span>
    {#if deck.length > 0}
      <span aria-hidden="true">·</span>
      <Button variant="link" onclick={clearAll} data-testid="chip-clear">Clear all</Button>
    {/if}
  </div>

  <div class="field">
    <label class="field-label" for="{uid}-add">Add cards</label>
    <div class="add-row">
      <input
        id="{uid}-add"
        class="input"
        bind:value={text}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        aria-describedby="{uid}-hint{error ? ` ${uid}-err` : ''}"
        aria-invalid={error ? 'true' : undefined}
        autocomplete="off"
        data-testid="chip-input"
        placeholder="1, 2, 3, 5, 8"
      />
      <Button icon="plus" onclick={add} data-testid="chip-add">Add</Button>
    </div>
    <p class="field-hint" id="{uid}-hint">Type values separated by commas, for example <code>1, 2, 3, 5, 8</code> or <code>S, M, L</code>, then press Enter.</p>
    {#if error}<p class="form-error" id="{uid}-err">{error}</p>{/if}
  </div>

  <div class="specials" role="group" aria-label="Special cards">
    {#each SPECIAL_CARDS as v (v)}
      <Button size="sm" variant="secondary" icon="plus" disabled={has(v)} onclick={() => commit(addValues(deck, v, false).deck, `Added ${SPECIAL_NAMES[v]}.`)}>
        {v} {SPECIAL_NAMES[v]}
      </Button>
    {/each}
  </div>

  {#if deck.length > 0}
    <ol class="chips" aria-label="Your deck, in order">
      {#each deck as card, i (card.value)}
        <li
          class="chip"
          class:over={dragOver === i}
          class:special={card.kind === 'special'}
          draggable="true"
          ondragstart={(e) => {
            dragFrom = i;
            e.dataTransfer?.setData('text/plain', card.value);
          }}
          ondragover={(e) => {
            e.preventDefault();
            dragOver = i;
          }}
          ondragleave={() => (dragOver = null)}
          ondrop={(e) => {
            e.preventDefault();
            if (dragFrom !== null && dragFrom !== i) moveCard(dragFrom, i);
            dragFrom = null;
            dragOver = null;
          }}
          ondragend={() => {
            dragFrom = null;
            dragOver = null;
          }}
          data-testid="chip"
          data-value={card.value}
        >
          <button
            bind:this={chips[i]}
            type="button"
            class="value"
            aria-label="{cardName(card)}, position {i + 1} of {deck.length}"
            aria-describedby="{uid}-order"
            onkeydown={(e) => onchipkey(e, i)}
          >{card.value}</button>
          <button type="button" class="x" aria-label="Remove {cardName(card)}" tabindex="-1" onclick={() => remove(i)}>
            <Icon name="x" size={14} />
          </button>
        </li>
      {/each}
    </ol>
    <p class="field-hint" id="{uid}-order">Drag a card to move it, or focus it and press Alt with the arrow keys. Delete removes it.</p>

    <details class="disclosure">
      <summary>Edit card colors</summary>
      <DeckColorSwatches {deck} {onchange} onreset={() => onchange(autoColor(deck))} />
    </details>
  {/if}
  <p class="visually-hidden" aria-live="polite">{note}</p>
</div>

<style>
  .chip-editor {
    display: grid;
    gap: var(--space-4);
  }

  .source {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .add-row {
    display: flex;
    gap: var(--space-2);
  }

  .add-row .input {
    flex: 1;
    min-width: 0;
    max-width: 24rem;
  }

  .specials {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--control-sm);
    padding: 0 var(--space-1) 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    font-weight: var(--weight-semibold);
    cursor: grab;
  }

  .chip.special {
    border-style: dashed;
  }

  .chip.over {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-accent-soft);
  }

  .value {
    min-width: 1ch;
    padding: 0 var(--space-1);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: inherit;
    font-weight: inherit;
    text-align: center;
    cursor: grab;
  }

  .x {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-full);
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .x:hover {
    background: var(--color-surface-2);
    color: var(--color-text);
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.9em;
  }
</style>
