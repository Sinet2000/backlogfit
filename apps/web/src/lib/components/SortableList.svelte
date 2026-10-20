<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import MenuButton, { type MenuItem } from './MenuButton.svelte';

  interface Props {
    items: readonly T[];
    key: (item: T) => string;
    label: (item: T) => string;
    onmove: (from: number, to: number) => void;
    onremove?: (index: number) => void;
    row: Snippet<[T, number]>;
    actions?: Snippet<[T, number]>;
    extraItems?: (item: T, index: number) => MenuItem[];
    rowClass?: (item: T) => string;
    listLabel: string;
    itemTestId?: string;
    removeTestId?: string;
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
    extraItems,
    rowClass,
    listLabel,
    itemTestId = 'sortable-item',
    removeTestId = 'item-remove',
    itemAttrs,
  }: Props = $props();

  let dragFrom = $state<number | null>(null);
  let dragOver = $state<number | null>(null);

  function reset() {
    dragFrom = null;
    dragOver = null;
  }

  function menuFor(item: T, i: number): MenuItem[] {
    const out: MenuItem[] = [
      ...(extraItems?.(item, i) ?? []),
      {
        label: 'Move up',
        icon: 'up',
        disabled: i === 0,
        onselect: () => onmove(i, i - 1),
        testid: 'move-up',
      },
      {
        label: 'Move down',
        icon: 'down',
        disabled: i === items.length - 1,
        onselect: () => onmove(i, i + 1),
        testid: 'move-down',
      },
    ];
    if (onremove) {
      out.push({
        label: 'Remove',
        icon: 'trash',
        danger: true,
        onselect: () => onremove(i),
        testid: removeTestId,
      });
    }
    return out;
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
      <span class="grip" aria-hidden="true" title="Drag to change the order">⋮⋮</span>
      <span class="num" aria-hidden="true">{i + 1}</span>
      <span class="content">{@render row(item, i)}</span>
      <span class="tools">
        {@render actions?.(item, i)}
        <MenuButton label="Actions for {label(item)}" items={menuFor(item, i)} size="sm" testid="row-menu" />
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
    gap: 2px;
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--target-min);
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-1);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
  }

  .row:hover,
  .row:focus-within {
    background: var(--color-surface-2);
  }

  .row:global(.current) {
    background: var(--color-accent-soft);
  }

  .row:global(.done) .content {
    color: var(--color-text-muted);
  }

  .row.over {
    border-color: var(--color-accent);
    border-style: dashed;
  }

  .row.dragging {
    opacity: 0.5;
  }

  .grip {
    width: 12px;
    cursor: grab;
    color: var(--color-text-muted);
    letter-spacing: -2px;
    user-select: none;
    visibility: hidden;
  }

  .row:hover .grip {
    visibility: visible;
  }

  .num {
    min-width: 2ch;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .content {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .tools {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    flex: none;
  }

  @media (hover: hover) {
    .tools {
      position: absolute;
      top: 50%;
      right: var(--space-1);
      padding-left: var(--space-2);
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      transform: translateY(-50%);
      opacity: 0;
    }

    .row:global(.current) .tools {
      background: var(--color-accent-soft);
    }

    .row:hover .tools,
    .row:focus-within .tools,
    .tools:has(:global([aria-expanded='true'])) {
      opacity: 1;
    }
  }

  @media (pointer: coarse) {
    .grip {
      display: none;
    }
  }
</style>
