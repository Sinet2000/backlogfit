<script lang="ts">
  import Button from '../components/Button.svelte';
  import { useRoom, viewOf } from './context.ts';
  import TaskAddForm from './TaskAddForm.svelte';

  const room = useRoom();
  const view = $derived(viewOf(room));
  const upNext = $derived(view.tasks.find((t) => t.id === room.upNextId) ?? null);
  const started = $derived(view.tasks.some((t) => t.final !== null || t.rounds.length > 0));
  const allDone = $derived(view.tasks.length > 0 && upNext === null);
  const here = $derived(view.participants.length);
</script>

<div class="empty" data-testid="empty-stage">
  {#if room.canFacilitate && view.tasks.length === 0}
    <h2>Add the tasks you want to estimate</h2>
    <p class="muted">Paste them from a spreadsheet or your tracker. You can add more at any time.</p>
    <div class="form"><TaskAddForm /></div>
  {:else if room.canFacilitate && upNext}
    <p class="label">{started ? 'Up next' : 'Up first'}</p>
    <h2 class="task">
      {#if upNext.key}<span class="key">{upNext.key}</span>{/if}
      {upNext.title ?? (upNext.key ? '' : 'Untitled task')}
    </h2>
    <Button variant="primary" size="lg" iconAfter="right" onclick={() => room.next()} data-testid="btn-next" aria-keyshortcuts="N">
      {started ? 'Continue estimating' : 'Start estimating'}
    </Button>
  {:else if allDone}
    <h2>All tasks are estimated</h2>
    <p class="muted">
      {room.canFacilitate ? 'Download the results below, or add more tasks to keep going.' : 'Thanks for estimating. The host may add more tasks.'}
    </p>
  {:else}
    <h2>The host will start soon</h2>
    <p class="muted">{here === 1 ? 'You are the first one here.' : `${here} people are here.`}</p>
  {/if}
</div>

<style>
  .empty {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    padding: var(--space-10) 0;
    text-align: center;
  }

  h2 {
    font-size: var(--text-2xl);
  }

  .label {
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--color-text-muted);
  }

  .task {
    max-width: 36rem;
    margin-bottom: var(--space-3);
    overflow-wrap: anywhere;
  }

  .key {
    font-family: var(--font-mono);
    font-size: 0.75em;
    margin-right: var(--space-2);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
    vertical-align: middle;
  }

  .form {
    width: min(100%, 36rem);
    margin-top: var(--space-3);
    text-align: left;
  }
</style>
