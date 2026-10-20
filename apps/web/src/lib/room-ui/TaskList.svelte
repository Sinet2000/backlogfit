<script lang="ts">
  import type { RoomView } from '@backlogfit/core';
  import Button from '../components/Button.svelte';
  import IconButton from '../components/IconButton.svelte';
  import type { RoomStore } from '../room/room.svelte.ts';

  interface Props {
    room: RoomStore;
    view: RoomView;
    canManage: boolean;
  }
  let { room, view, canManage }: Props = $props();

  let text = $state('');
  const policyHint = $derived(
    view.config.taskPolicy === 'ids'
      ? 'One per line: an ID with an optional title, e.g. SCP-3655 Fix login. Links are reduced to their ID.'
      : view.config.taskPolicy === 'links'
        ? 'One per line: an ID, a title, or a link (https://…) followed by a title.'
        : 'One per line: an ID, a title, or a link to an allowed domain.',
  );

  function add() {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '')
      .slice(0, 200);
    if (lines.length === 0) return;
    room.send({ type: 'admin.tasks.add', lines });
    text = '';
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      add();
    }
  }

  const label = (t: { key: string | null; title: string | null }) =>
    [t.key, t.title].filter(Boolean).join(' ') || 'Untitled task';
</script>

<section class="tasks" aria-labelledby="tasks-h">
  <h2 id="tasks-h">Tasks <span class="count">{view.tasks.filter((t) => t.final !== null).length} of {view.tasks.length} estimated</span></h2>

  {#if canManage}
    <div class="add field">
      <label class="field-label" for="task-input">Add tasks</label>
      <p class="field-hint" id="task-hint">{policyHint}</p>
      <textarea
        id="task-input"
        class="textarea"
        bind:value={text}
        {onkeydown}
        rows="3"
        aria-describedby="task-hint"
        placeholder="SCP-3655 Fix login timeout"
        data-testid="task-input"
      ></textarea>
      <Button icon="plus" onclick={add} disabled={text.trim() === ''} data-testid="task-add">Add tasks</Button>
    </div>
  {/if}

  {#if view.tasks.length === 0}
    <p class="muted empty">{canManage ? 'No tasks yet. Paste a few above to get started.' : 'The host has not added tasks yet.'}</p>
  {:else}
    <ol class="list">
      {#each view.tasks as t, i (t.id)}
        <li class:current={t.id === view.currentTaskId} data-testid="task-item" data-key={t.key ?? ''} data-final={t.final ?? ''}>
          <span class="text">
            <span class="name">{label(t)}</span>
            {#if t.id === view.currentTaskId}<span class="badge">Now</span>{/if}
          </span>
          {#if t.final !== null}<span class="final" title="Final estimate">{t.final}</span>{/if}
          {#if canManage}
            <span class="tools">
              {#if t.id !== view.currentTaskId}
                <Button size="sm" variant="quiet" onclick={() => room.send({ type: 'admin.select', taskId: t.id })} data-testid="task-select">
                  Estimate<span class="visually-hidden"> {label(t)}</span>
                </Button>
              {/if}
              <IconButton icon="up" size="sm" label="Move {label(t)} up" disabled={i === 0} onclick={() => room.send({ type: 'admin.tasks.move', taskId: t.id, toIndex: i - 1 })} />
              <IconButton icon="down" size="sm" label="Move {label(t)} down" disabled={i === view.tasks.length - 1} onclick={() => room.send({ type: 'admin.tasks.move', taskId: t.id, toIndex: i + 1 })} />
              <IconButton icon="trash" size="sm" variant="danger" label="Remove {label(t)}" onclick={() => room.send({ type: 'admin.tasks.remove', taskId: t.id })} data-testid="task-remove" />
            </span>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  h2 {
    font-size: var(--text-md);
    margin-bottom: var(--space-3);
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

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
    counter-reset: task;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-md);
    counter-increment: task;
  }

  li::before {
    content: counter(task);
    width: 2ch;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  li.current {
    background: var(--color-accent-soft);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    color: var(--color-accent);
  }

  .final {
    min-width: 2.5ch;
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--color-success-soft);
    color: var(--color-success);
    font-weight: var(--weight-bold);
    text-align: center;
  }

  .tools {
    display: inline-flex;
    align-items: center;
  }

  .empty {
    font-size: var(--text-sm);
  }
</style>
