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

  function add(estimateNow = false) {
    if (room.addTasks(text, { estimateNow }) === 0) return;
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
  <p class="field-hint" id="{uid}-hint">{hint}</p>
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
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
