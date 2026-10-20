<script lang="ts">
  import { type TaskView, votersLabel } from '@backlogfit/core';
  import { onDestroy } from 'svelte';
  import Button from '../components/Button.svelte';
  import IconButton from '../components/IconButton.svelte';
  import type { MenuItem } from '../components/MenuButton.svelte';
  import PanelHeader from '../components/PanelHeader.svelte';
  import SortableList from '../components/SortableList.svelte';
  import { toasts } from '../toast.svelte.ts';
  import { useRoom, viewOf } from './context.ts';
  import TaskAddForm from './TaskAddForm.svelte';
  import TaskRow from './TaskRow.svelte';

  const UNDO_MS = 5000;

  const room = useRoom();
  const view = $derived(viewOf(room));
  let adding = $state(false);
  let removing = $state<Record<string, ReturnType<typeof setTimeout>>>({});

  const tasks = $derived(view.tasks.filter((t) => !(t.id in removing)));
  const estimated = $derived(tasks.filter((t) => t.final !== null).length);
  const label = (t: TaskView) => [t.key, t.title].filter(Boolean).join(' ') || 'Untitled task';
  const by = (t: TaskView) => (t.voters === null ? null : votersLabel(t.voters, room.teams));

  function votersMenu(t: TaskView): MenuItem[] {
    if (room.teams.length === 0) return [];
    const current = t.voters?.length === 1 ? t.voters[0] : t.voters === null ? null : undefined;
    return [{ id: null, name: 'Everyone' }, ...room.teams].map((team) => ({
      label: team.name,
      group: 'Estimated by',
      checked: current === team.id,
      onselect: () => room.setVoters(t.id, team.id === null ? null : [team.id]),
      testid: `task-voters-${team.id ?? 'all'}`,
    }));
  }

  function move(from: number, to: number) {
    const task = tasks[from];
    const target = tasks[to];
    if (!task || !target) return;
    room.moveTask(task.id, view.tasks.indexOf(target));
  }

  function remove(i: number) {
    const task = tasks[i];
    if (!task) return;
    const timer = setTimeout(() => commit(task.id), UNDO_MS);
    removing = { ...removing, [task.id]: timer };
    toasts.show(`Removed ${label(task)}.`, 'info', {
      ms: UNDO_MS,
      action: { label: 'Undo', run: () => undo(task.id) },
    });
  }

  function commit(id: string) {
    const { [id]: timer, ...rest } = removing;
    if (timer === undefined) return;
    clearTimeout(timer);
    removing = rest;
    room.removeTask(id);
  }

  function undo(id: string) {
    const { [id]: timer, ...rest } = removing;
    clearTimeout(timer);
    removing = rest;
  }

  onDestroy(() => {
    for (const id of Object.keys(removing)) commit(id);
  });
</script>

<section class="tasks" aria-labelledby="tasks-h">
  <PanelHeader id="tasks-h" title="Tasks" count="{estimated}/{tasks.length}" countLabel="{estimated} of {tasks.length} estimated">
    {#snippet actions()}
      {#if room.canFacilitate && tasks.length > 0 && !adding}
        <Button size="sm" variant="ghost" icon="plus" onclick={() => (adding = true)} data-testid="task-add-open">Add</Button>
      {/if}
    {/snippet}
  </PanelHeader>

  {#if room.canFacilitate && adding}
    <div class="form">
      <TaskAddForm autofocus oncancel={() => (adding = false)} ondone={() => (adding = false)} />
    </div>
  {/if}

  {#if tasks.length === 0}
    <p class="muted empty">{room.canFacilitate ? 'No tasks yet. Add them in the main panel.' : 'The host has not added tasks yet.'}</p>
  {:else if room.canFacilitate}
    <p class="field-hint hint">Tasks are estimated top to bottom. Drag to change the order.</p>
    <SortableList
      items={tasks}
      key={(t) => t.id}
      {label}
      onmove={move}
      onremove={remove}
      extraItems={(t) => votersMenu(t)}
      listLabel="Tasks, in order"
      itemTestId="task-item"
      removeTestId="task-remove"
      itemAttrs={(t) => ({ 'data-key': t.key ?? '', 'data-final': t.final ?? '' })}
      rowClass={(t) => (t.id === view.currentTaskId ? 'current' : t.final !== null ? 'done' : '')}
    >
      {#snippet row(t)}
        <TaskRow task={t} current={t.id === view.currentTaskId} next={t.id === room.upNextId} by={by(t)} />
      {/snippet}
      {#snippet actions(t)}
        {#if t.id !== view.currentTaskId}
          <IconButton icon="play" size="sm" label="Estimate {label(t)} now" onclick={() => room.select(t.id)} data-testid="task-select" />
        {/if}
      {/snippet}
    </SortableList>
  {:else}
    <ol class="list">
      {#each tasks as t, i (t.id)}
        <li class:current={t.id === view.currentTaskId} class:done={t.final !== null} data-testid="task-item" data-key={t.key ?? ''} data-final={t.final ?? ''}>
          <span class="num" aria-hidden="true">{i + 1}</span>
          <TaskRow task={t} current={t.id === view.currentTaskId} next={t.id === room.upNextId} by={by(t)} />
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .form {
    margin-bottom: var(--space-4);
  }

  .hint {
    margin-bottom: var(--space-2);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }

  .list li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--control-md);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-md);
  }

  .list li.current {
    background: var(--color-accent-soft);
  }

  .list li.done {
    color: var(--color-text-muted);
  }

  .num {
    min-width: 2ch;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .empty {
    font-size: var(--text-sm);
  }
</style>
