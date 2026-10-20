<script lang="ts">
  import Button from '../components/Button.svelte';
  import { useRoom, viewOf } from './context.ts';

  interface Props {
    autofocus?: boolean;
    oncancel?: () => void;
    ondone?: () => void;
  }
  let { autofocus = false, oncancel, ondone }: Props = $props();

  const room = useRoom();
  const view = $derived(viewOf(room));
  const uid = $props.id();
  let text = $state('');
  let by = $state('');
  let input: HTMLTextAreaElement | undefined = $state();

  $effect(() => {
    if (autofocus) input?.focus();
  });

  const hint = $derived(
    view.config.taskPolicy === 'ids'
      ? 'One task per line: an ID with an optional title, for example SCP-3655 Fix login. Links are shortened to their ID.'
      : view.config.taskPolicy === 'links'
        ? 'One task per line: an ID, a title, or a link (https://…) followed by a title.'
        : 'One task per line: an ID, a title, or a link to an allowed domain.',
  );

  const tagHint = $derived(
    room.teams.length > 0
      ? ` End a line with a team tag such as #${room.teams[0]?.name.toLowerCase().replace(/\s+/g, '')} to choose who estimates it.`
      : '',
  );

  function add(estimateNow = false) {
    const voters = by === '' || !room.teams.some((t) => t.id === by) ? null : [by];
    if (room.addTasks(text, { estimateNow, voters }).count === 0) return;
    text = '';
    ondone?.();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      add(e.shiftKey);
    } else if (e.key === 'Escape' && oncancel) {
      oncancel();
    }
  }
</script>

<div class="add field">
  <label class="field-label" for="{uid}-tasks">Add tasks</label>
  <textarea
    bind:this={input}
    id="{uid}-tasks"
    class="textarea"
    bind:value={text}
    {onkeydown}
    rows="3"
    aria-describedby="{uid}-hint"
    placeholder={'SCP-3655 Fix login timeout\nSCP-3656 Export to PDF'}
    data-testid="task-input"
  ></textarea>
  <p class="field-hint" id="{uid}-hint">{hint}{tagHint}</p>
  {#if room.teams.length > 0}
    <div class="by">
      <label class="field-label" for="{uid}-by">Estimated by</label>
      <select id="{uid}-by" class="select" bind:value={by} data-testid="task-add-voters">
        <option value="">Everyone</option>
        {#each room.teams as t (t.id)}
          <option value={t.id}>{t.name}</option>
        {/each}
      </select>
    </div>
  {/if}
  <div class="buttons">
    <Button variant="primary" icon="plus" onclick={() => add()} disabled={text.trim() === ''} data-testid="task-add">
      Add to list
    </Button>
    <Button variant="ghost" icon="play" onclick={() => add(true)} disabled={text.trim() === ''} data-testid="task-add-now">
      Add and estimate now
    </Button>
    {#if oncancel}
      <Button variant="ghost" onclick={oncancel}>Cancel</Button>
    {/if}
  </div>
</div>

<style>
  .by {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .by .select {
    width: auto;
    min-width: 10rem;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
