<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    title: string;
    count?: string | number;
    countLabel?: string;
    actions?: Snippet;
  }
  let { id, title, count, countLabel, actions }: Props = $props();
</script>

<div class="panel-header">
  <h2 {id}>
    {title}
    {#if count !== undefined}
      <span class="count" aria-label={countLabel}>{count}</span>
    {/if}
  </h2>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: var(--control-md);
    margin-bottom: var(--space-3);
  }

  h2 {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-md);
  }

  .count {
    display: inline-grid;
    place-items: center;
    min-width: 24px;
    height: 22px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    font-variant-numeric: tabular-nums;
  }

  :global(:root[data-mode='contrast']) .count {
    border: 1px solid var(--color-border);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
</style>
