<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';

  interface Props {
    items: readonly T[];
    key: (item: T) => string;
    /** Accessible name of an item, used in the move/remove button labels. */
    label: (item: T) => string;
    onmove: (from: number, to: number) => void;
    onremove?: (index: number) => void;
    row: Snippet<[T, number]>;
    actions?: Snippet<[T, number]>;
    rowClass?: (item: T) => string;
    listLabel: string;
    itemTestId?: string;
    removeTestId?: string;
    /** Extra data-* attributes per row (test hooks). */
    itemAttrs?: (item: T) => Record<`data-${string}`, string>;
  }
  let {
    items,
    key,
    label,
    onmove,
    onremove,
    row,
    actions,
    rowClass,
    listLabel,
    itemTestId = 'sortable-item',
    removeTestId = 'item-remove',
    itemAttrs,
  }: Props = $props();

  // Pointer drag-and-drop; the move buttons cover keyboard, touch and screen readers.
  let dragFrom = $state<number | null>(null);
  let dragOver = $state<number | null>(null);

  function reset() {
    dragFrom = null;
    dragOver = null;
  }
</script>

<ol class="sortable" aria-label={listLabel}>
  {#each items as item, i (key(item))}
    <li
      class="row {rowClass?.(item) ?? ''}"
      class:over={dragOver === i && dragFrom !== i}
      class:dragging={dragFrom === i}
      draggable="true"
      ondragstart={(e) => {
        dragFrom = i;
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', label(item));
        }
      }}
      ondragover={(e) => {
        if (dragFrom === null) return;
        e.preventDefault();
        dragOver = i;
      }}
      ondragleave={() => {
        if (dragOver === i) dragOver = null;
      }}
      ondrop={(e) => {
        e.preventDefault();
        if (dragFrom !== null && dragFrom !== i) onmove(dragFrom, i);
        reset();
      }}
      ondragend={reset}
      data-testid={itemTestId}
      {...itemAttrs?.(item)}
    >
      <span class="grip" aria-hidden="true" title="Drag to reorder">⋮⋮</span>
      <span class="num" aria-hidden="true">{i + 1}</span>
      <span class="content">{@render row(item, i)}</span>
      <span class="tools">
        {@render actions?.(item, i)}
        <IconButton icon="up" size="sm" label="Move {label(item)} up" disabled={i === 0} onclick={() => onmove(i, i - 1)} data-testid="move-up" />
        <IconButton icon="down" size="sm" label="Move {label(item)} down" disabled={i === items.length - 1} onclick={() => onmove(i, i + 1)} data-testid="move-down" />
        {#if onremove}
          <IconButton icon="trash" size="sm" variant="danger" label="Remove {label(item)}" onclick={() => onremove(i)} data-testid={removeTestId} />
        {/if}
      </span>
    </li>
  {/each}
</ol>

<style>
  .sortable {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-1);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: var(--space-1) var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .row:global(.current) {
    background: var(--color-accent-soft);
  }

  .row:global(.done) .content {
    color: var(--color-text-muted);
  }

  .row:hover .grip {
    color: var(--color-text);
  }

  .row.over {
    border-color: var(--color-accent);
    border-style: dashed;
  }

  .row.dragging {
    opacity: 0.5;
  }

  .grip {
    cursor: grab;
    color: var(--color-text-muted);
    letter-spacing: -2px;
    user-select: none;
  }

  .num {
    min-width: 2ch;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  .content {
    flex: 1 1 8rem;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .tools {
    display: inline-flex;
    align-items: center;
    margin-left: auto;
  }

  @media (pointer: coarse) {
    .grip {
      display: none;
    }
  }
</style>
