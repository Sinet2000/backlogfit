<script lang="ts">
  import type { TaskView } from '@backlogfit/core';
  import TeamBadge from './TeamBadge.svelte';

  interface Props {
    task: TaskView;
    current: boolean;
    next: boolean;
    /** "QA" or "Dev, QA" for a task only some teams estimate. */
    by?: string | null;
  }
  let { task, current, next, by = null }: Props = $props();
</script>

<span class="task">
  <span class="text">
    {#if task.key}<span class="key">{task.key}</span>{/if}
    {#if task.title || !task.key}<span class="title">{task.title ?? 'Untitled task'}</span>{/if}
  </span>
  {#if by}<TeamBadge name={by} testid="task-voters" />{/if}
  {#if task.final !== null}
    <span class="chip final" title="Final estimate">{task.final}</span>
  {:else if current}
    <span class="chip now">Now</span>
  {:else if next}
    <span class="chip">Next</span>
  {/if}
</span>

<style>
  .task {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .key {
    margin-right: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    white-space: nowrap;
  }

  .chip {
    flex: none;
    min-width: 2.5rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    line-height: 22px;
    text-align: center;
  }

  .chip.now {
    background: var(--color-accent);
    color: var(--color-accent-text);
  }

  .chip.final {
    background: var(--color-success-soft);
    color: var(--color-success);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  :global(:root[data-mode='contrast']) .chip {
    border: 1px solid var(--color-border);
  }
</style>
