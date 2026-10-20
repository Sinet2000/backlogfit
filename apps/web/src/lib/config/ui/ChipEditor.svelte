<script lang="ts">
  import type { Card } from '@backlogfit/core';
  import { cardName } from '../cards.ts';
  import { addValues, autoColor, move, removeAt, setColor } from '../config/chips.ts';
  import Button from './Button.svelte';
  import IconButton from './IconButton.svelte';

  interface Props {
    deck: Card[];
    onchange: (deck: Card[]) => void;
  }
  let { deck, onchange }: Props = $props();

  let text = $state('');
  let autoColors = $state(true);
  let note = $state('');
  let dragFrom = $state<number | null>(null);
  let dragOver = $state<number | null>(null);
  const uid = $props.id();

  function commit(next: Card[], message = '') {
    onchange(next);
    note = message;
  }

  function add() {
    if (text.trim() === '') return;
    const { deck: next, skipped } = addValues(deck, text, autoColors);
    text = '';
    commit(
      next,
      skipped.length ? `Skipped: ${skipped.join(', ')} (duplicate or too long).` : 'Cards added.',
    );
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  }

  function moveCard(i: number, to: number) {
    const card = deck[i];
    const next = move(deck, i, to);
    commit(
      autoColors ? autoColor(next) : next,
      `Moved ${card?.value} to position ${to + 1} of ${deck.length}.`,
    );
  }

  function remove(i: number) {
    const card = deck[i];
    const next = removeAt(deck, i);
    commit(autoColors ? autoColor(next) : next, `Removed ${card?.value}.`);
  }

  function color(i: number, value: string) {
    autoColors = false;
    commit(setColor(deck, i, value));
  }

  function resetColors() {
    autoColors = true;
    commit(autoColor(deck), 'Colors reset to the colorblind-safe palette.');
  }

  function addSpecial(v: string) {
    const { deck: next } = addValues(deck, v, autoColors);
    commit(next, `Added ${v}.`);
  }

  function drop(i: number) {
    if (dragFrom !== null && dragFrom !== i) moveCard(dragFrom, i);
    dragFrom = null;
    dragOver = null;
  }

  const SPECIAL_BUTTONS: readonly [string, string][] = [
    ['?', 'Unclear'],
    ['☕', 'Coffee break'],
    ['∞', 'Too big'],
  ];
  const has = (v: string) => deck.some((c) => c.value === v);
</script>

<div class="chip-editor">
  <div class="field">
    <label class="field-label" for="{uid}-add">Add cards</label>
    <p class="field-hint" id="{uid}-hint">Type values separated by commas, for example <code>1, 2, 3, 5, 8</code> or <code>S, M, L</code>, then press Enter.</p>
    <div class="add-row">
      <input
        id="{uid}-add"
        class="input"
        bind:value={text}
        {onkeydown}
        aria-describedby="{uid}-hint"
        autocomplete="off"
        data-testid="chip-input"
        placeholder="1, 2, 3, 5, 8"
      />
      <Button icon="plus" onclick={add} data-testid="chip-add">Add</Button>
    </div>
  </div>

  <div class="specials" role="group" aria-label="Special cards">
    {#each SPECIAL_BUTTONS as [v, name] (v)}
      <Button size="sm" variant="secondary" disabled={has(v)} onclick={() => addSpecial(v)}>
        + {v} {name}
      </Button>
    {/each}
  </div>

  <ol class="chips" aria-label="Your deck, in order">
    {#each deck as card, i (card.value)}
      <li
        class="chip"
        class:over={dragOver === i}
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
          drop(i);
        }}
        ondragend={() => {
          dragFrom = null;
          dragOver = null;
        }}
        data-testid="chip"
        data-value={card.value}
      >
        <span class="grip" aria-hidden="true">⋮⋮</span>
        <span class="swatch-wrap">
          <input
            type="color"
            class="swatch"
            value={card.color}
            aria-label="Color of card {cardName(card)}"
            oninput={(e) => color(i, e.currentTarget.value)}
          />
        </span>
        <span class="value">{card.value}</span>
        <span class="tools">
          <IconButton icon="left" size="sm" label="Move {cardName(card)} earlier" disabled={i === 0} onclick={() => moveCard(i, i - 1)} />
          <IconButton icon="right" size="sm" label="Move {cardName(card)} later" disabled={i === deck.length - 1} onclick={() => moveCard(i, i + 1)} />
          <IconButton icon="x" size="sm" variant="danger" label="Remove {cardName(card)}" onclick={() => remove(i)} />
        </span>
      </li>
    {/each}
  </ol>

  <div class="foot">
    <Button size="sm" variant="quiet" icon="refresh" onclick={resetColors} disabled={autoColors}>
      Use automatic colors
    </Button>
    <span class="muted small">Automatic colors are readable for color-blind people. Card values are always shown as text.</span>
  </div>
  <p class="visually-hidden" aria-live="polite">{note}</p>
</div>

<style>
  .chip-editor {
    display: grid;
    gap: var(--space-4);
  }

  .add-row {
    display: flex;
    gap: var(--space-2);
  }

  .add-row .input {
    flex: 1;
    min-width: 0;
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
    padding: var(--space-1) var(--space-1) var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    cursor: grab;
  }

  .chip.over {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-accent-soft);
  }

  .grip {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    letter-spacing: -2px;
  }

  .swatch-wrap {
    display: inline-grid;
  }

  .swatch {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
  }

  .value {
    min-width: 2ch;
    font-weight: var(--weight-semibold);
    text-align: center;
  }

  .tools {
    display: inline-flex;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .small {
    font-size: var(--text-sm);
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.9em;
  }
</style>
