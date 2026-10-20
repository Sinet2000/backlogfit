<script lang="ts">
  import type { RoomView, TaskView } from '@backlogfit/core';
  import Button from '../components/Button.svelte';
  import IconButton from '../components/IconButton.svelte';
  import SortableList from '../components/SortableList.svelte';
  import { splitLines } from '../room/agenda.ts';
  import type { RoomStore } from '../room/room.svelte.ts';

  interface Props {
    room: RoomStore;
    view: RoomView;
    canManage: boolean;
  }
  let { room, view, canManage }: Props = $props();

  let text = $state('');
  let adding = $state(false);
  // Index of the first task of an "add and estimate now" batch, until it shows up in the view.
  let selectFrom = $state<number | null>(null);

  const showForm = $derived(canManage && (adding || view.tasks.length === 0));
  const policyHint = $derived(
    view.config.taskPolicy === 'ids'
      ? 'One per line: an ID with an optional title, e.g. SCP-3655 Fix login. Links are reduced to their ID.'
      : view.config.taskPolicy === 'links'
        ? 'One per line: an ID, a title, or a link (https://…) followed by a title.'
        : 'One per line: an ID, a title, or a link to an allowed domain.',
  );

  // The task Next will open: the first unestimated one after the current task, wrapping around
  // (same rule as the server).
  const upNextId = $derived.by(() => {
    const start = view.tasks.findIndex((t) => t.id === view.currentTaskId);
    const ordered = [...view.tasks.slice(start + 1), ...view.tasks.slice(0, Math.max(start, 0))];
    return ordered.find((t) => t.final === null)?.id ?? null;
  });

  $effect(() => {
    if (selectFrom === null) return;
    const task = view.tasks[selectFrom];
    if (task) {
      room.send({ type: 'admin.select', taskId: task.id });
      selectFrom = null;
    }
  });

  function add(estimateNow = false) {
    const lines = splitLines(text).slice(0, 200);
    if (lines.length === 0) return;
    if (estimateNow) selectFrom = view.tasks.length;
    room.send({ type: 'admin.tasks.add', lines });
    text = '';
    adding = false;
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      add(e.shiftKey);
    } else if (e.key === 'Escape' && view.tasks.length > 0) {
      adding = false;
    }
  }

  const label = (t: TaskView) => [t.key, t.title].filter(Boolean).join(' ') || 'Untitled task';
  const move = (from: number, to: number) => {
    const t = view.tasks[from];
    if (t && to >= 0 && to < view.tasks.length) {
      room.send({ type: 'admin.tasks.move', taskId: t.id, toIndex: to });
    }
  };
</script>

<section class="tasks" aria-labelledby="tasks-h">
  <div class="head">
    <h2 id="tasks-h">Tasks <span class="count">{view.tasks.filter((t) => t.final !== null).length} of {view.tasks.length} estimated</span></h2>
    {#if canManage && view.tasks.length > 0 && !adding}
      <Button size="sm" variant="quiet" icon="plus" onclick={() => (adding = true)} data-testid="task-add-open">Add</Button>
    {/if}
  </div>

  {#if showForm}
    <div class="add field">
      <label class="field-label" for="task-input">Add tasks</label>
      <p class="field-hint" id="task-hint">{policyHint}</p>
      <!-- svelte-ignore a11y_autofocus -->
      <textarea
        id="task-input"
        class="textarea"
        bind:value={text}
        {onkeydown}
        rows="3"
        aria-describedby="task-hint"
        placeholder="SCP-3655 Fix login timeout"
        autofocus={adding}
        data-testid="task-input"
      ></textarea>
      <div class="add-actions">
        <Button icon="plus" onclick={() => add()} disabled={text.trim() === ''} data-testid="task-add">Add to list</Button>
        <Button variant="quiet" icon="play" onclick={() => add(true)} disabled={text.trim() === ''} data-testid="task-add-now">Add and estimate now</Button>
        {#if view.tasks.length > 0}
          <Button variant="ghost" onclick={() => (adding = false)}>Cancel</Button>
        {/if}
      </div>
    </div>
  {/if}

  {#if view.tasks.length === 0}
    <p class="muted empty">{canManage ? 'No tasks yet. Paste a few above to get started.' : 'The host has not added tasks yet.'}</p>
  {:else if canManage}
    <p class="field-hint order-hint">Next follows this order and skips estimated tasks. Drag to reorder; ▶ estimates a task now.</p>
    <SortableList
      items={view.tasks}
      key={(t) => t.id}
      {label}
      onmove={move}
      onremove={(i) => {
        const t = view.tasks[i];
        if (t) room.send({ type: 'admin.tasks.remove', taskId: t.id });
      }}
      listLabel="Tasks, in order"
      itemTestId="task-item"
      removeTestId="task-remove"
      itemAttrs={(t) => ({ 'data-key': t.key ?? '', 'data-final': t.final ?? '' })}
      rowClass={(t) => (t.id === view.currentTaskId ? 'current' : t.final !== null ? 'done' : '')}
    >
      {#snippet row(t)}
        {@render taskText(t)}
      {/snippet}
      {#snippet actions(t)}
        {#if t.id !== view.currentTaskId}
          <IconButton icon="play" size="sm" label="Estimate {label(t)} now" onclick={() => room.send({ type: 'admin.select', taskId: t.id })} data-testid="task-select" />
        {/if}
      {/snippet}
    </SortableList>
  {:else}
    <ol class="list">
      {#each view.tasks as t (t.id)}
        <li class:current={t.id === view.currentTaskId} class:done={t.final !== null} data-testid="task-item" data-key={t.key ?? ''} data-final={t.final ?? ''}>
          {@render taskText(t)}
        </li>
      {/each}
    </ol>
  {/if}
</section>

{#snippet taskText(t: TaskView)}
  {#if t.key}<span class="key">{t.key}</span>{/if}
  {#if t.title || !t.key}<span class="name" title={t.title ?? undefined}>{t.title ?? 'Untitled task'}</span>{/if}
  {#if t.id === view.currentTaskId}<span class="badge now">Now</span>
  {:else if t.id === upNextId}<span class="badge">Up next</span>{/if}
  {#if t.final !== null}<span class="final" title="Final estimate">{t.final}</span>{/if}
{/snippet}

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  h2 {
    font-size: var(--text-md);
  }

  .count {
    color: var(--color-text-muted);
    font-weight: var(--weight-normal);
    font-size: var(--text-sm);
    margin-left: var(--space-1);
  }

  .add {
    margin-bottom: var(--space-4);
  }

  .add-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .order-hint {
    margin-bottom: var(--space-2);
  }

  .list {
    list-style: decimal inside;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }

  .list li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-md);
  }

  .list li.current {
    background: var(--color-accent-soft);
  }

  .list li.done {
    color: var(--color-text-muted);
  }

  .key {
    flex: none;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    white-space: nowrap;
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    flex: none;
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    color: var(--color-text-muted);
  }

  .badge.now {
    color: var(--color-accent);
  }

  .final {
    flex: none;
    min-width: 2.5ch;
    margin-left: auto;
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--color-success-soft);
    color: var(--color-success);
    font-weight: var(--weight-bold);
    text-align: center;
  }

  .empty {
    font-size: var(--text-sm);
  }
</style>
