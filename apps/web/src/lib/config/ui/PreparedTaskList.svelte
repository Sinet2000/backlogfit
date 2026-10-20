<script lang="ts">
  import { votersLabel } from '@backlogfit/core';
  import { tick } from 'svelte';
  import Icon from '../../components/Icon.svelte';
  import type { MenuItem } from '../../components/MenuButton.svelte';
  import SortableList from '../../components/SortableList.svelte';
  import { type PreparedItem, preparedErrorText } from '../../room/prepared-tasks.ts';
  import TeamBadge from '../../room-ui/TeamBadge.svelte';
  import type { SessionWizard } from '../wizard.svelte.ts';

  let { wizard }: { wizard: SessionWizard } = $props();

  let editing = $state<number | null>(null);
  let draft = $state('');
  let editor: HTMLInputElement | undefined = $state();

  const label = (i: PreparedItem) =>
    i.task ? [i.task.key, i.task.title].filter(Boolean).join(' ') || i.line : i.line;

  const teams = $derived(wizard.draft.teams);

  function menu(item: PreparedItem, i: number): MenuItem[] {
    const out: MenuItem[] = [
      { label: 'Edit', icon: 'edit', onselect: () => void edit(i), testid: 'prepared-edit' },
    ];
    if (teams.length === 0 || !item.task) return out;
    const current =
      item.voters === null ? null : item.voters.length === 1 ? item.voters[0] : undefined;
    for (const t of [{ id: null, name: 'Everyone' }, ...teams]) {
      out.push({
        label: t.name,
        group: 'Estimated by',
        checked: current === t.id,
        onselect: () => wizard.setLineVoters(i, t.id === null ? null : [t.id]),
        testid: `prepared-voters-${t.id ?? 'all'}`,
      });
    }
    return out;
  }

  async function edit(index: number) {
    editing = index;
    draft = wizard.lines[index] ?? '';
    await tick();
    editor?.focus();
    editor?.select();
  }

  function finish(save: boolean) {
    if (editing !== null && save) wizard.replaceLine(editing, draft);
    editing = null;
  }
</script>

<div class="prepared">
<SortableList
  items={wizard.items}
  key={(i) => i.line}
  {label}
  onmove={(from, to) => wizard.moveLine(from, to)}
  onremove={(idx) => wizard.removeLines([idx])}
  extraItems={menu}
  listLabel="Prepared tasks, in order"
  itemTestId="prepared-item"
  removeTestId="prepared-remove"
  rowClass={(i) => (i.error ? 'invalid' : '')}
>
  {#snippet row(item, i)}
    {#if editing === i}
      <input
        bind:this={editor}
        class="input edit"
        bind:value={draft}
        aria-label="Edit line {i + 1}"
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            finish(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
          }
        }}
        onblur={() => finish(true)}
        data-testid="prepared-edit-input"
      />
    {:else}
      <button type="button" class="line" onclick={() => void edit(i)} title="Click to edit">
        <span class="text">
          {#if item.task?.key}<span class="key">{item.task.key}</span>{/if}
          <span class="title">{item.task ? (item.task.title ?? (item.task.key ? '' : item.line)) : item.line}</span>
        </span>
        {#if item.voters && item.task}
          <TeamBadge name="Estimated by {votersLabel(item.voters, teams)}" testid="prepared-voters" />
        {/if}
        {#if item.shortened}
          <span class="chip" data-testid="prepared-shortened"><Icon name="link" size={12} /> Link shortened to ID</span>
        {/if}
        {#if item.error}
          <span class="error"><Icon name="alert" size={14} /> {preparedErrorText(item.error)}</span>
        {/if}
      </button>
    {/if}
  {/snippet}
</SortableList>
</div>

<style>
  .prepared :global(.row.invalid) {
    border-color: var(--color-danger);
    background: var(--color-danger-soft);
  }

  .line {
    display: grid;
    gap: var(--space-1);
    width: 100%;
    min-width: 0;
    padding: var(--space-1) 0;
    border: 0;
    background: none;
    color: inherit;
    text-align: left;
    cursor: text;
  }

  .text {
    overflow-wrap: anywhere;
  }

  .key {
    margin-right: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    width: fit-content;
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    line-height: 20px;
  }

  .error {
    display: flex;
    align-items: flex-start;
    gap: var(--space-1);
    color: var(--color-danger);
    font-size: var(--text-sm);
  }

  .error :global(.icon) {
    margin-top: 3px;
  }

  .edit {
    min-height: var(--control-md);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }
</style>
