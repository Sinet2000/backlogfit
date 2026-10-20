<script lang="ts">
import type { Card, RoomView, TaskView } from '@backlogfit/core';
import Button from '../components/Button.svelte';
import type { RoomStore } from '../room/room.svelte.ts';

interface Props {
  room: RoomStore;
  view: RoomView;
  task: TaskView | null;
}
let { room, view, task }: Props = $props();

const round = $derived(task?.rounds.find((r) => r.n === view.round) ?? null);
const estimable = $derived(view.config.scale.filter((c: Card) => c.kind !== 'special'));
let finalChoice = $state<string | null>(null);
let custom = $state('');

// Preselect the suggested card when a round is revealed.
$effect(() => {
  if (view.phase === 'revealed') finalChoice = task?.final ?? round?.stats?.suggested ?? null;
});

const remaining = $derived(
  view.tasks.filter((t) => t.final === null && t.id !== view.currentTaskId).length,
);

function saveFinal() {
  if (!task) return;
  const value = custom.trim() !== '' ? custom.trim().slice(0, 16) : finalChoice;
  if (!value) return;
  room.send({ type: 'admin.final', taskId: task.id, value });
  custom = '';
}
</script>

<div class="controls" aria-label="Facilitator controls" role="group">
  <div class="primary-row">
    {#if view.phase === 'voting'}
      <Button variant="primary" icon="eye" onclick={() => room.send({ type: 'admin.reveal' })} data-testid="btn-reveal" aria-keyshortcuts="Space">
        Reveal votes
      </Button>
      <Button icon="refresh" onclick={() => room.send({ type: 'admin.revote' })} data-testid="btn-revote">
        Clear votes
      </Button>
    {:else if view.phase === 'revealed'}
      <Button icon="refresh" onclick={() => room.send({ type: 'admin.revote' })} data-testid="btn-revote">
        Vote again
      </Button>
    {/if}
    <Button
      variant={view.phase === 'voting' ? 'secondary' : 'primary'}
      iconAfter="next"
      onclick={() => room.send({ type: 'admin.next' })}
      disabled={view.tasks.length === 0}
      data-testid="btn-next"
      aria-keyshortcuts="N"
    >
      {view.currentTaskId === null ? 'Start first task' : remaining > 0 ? 'Next task' : 'Finish'}
    </Button>
    {#if view.phase === 'voting'}
      {#if view.timer}
        <Button variant="ghost" icon="timer" onclick={() => room.send({ type: 'admin.timer', action: 'stop' })} data-testid="btn-timer-stop">
          Stop timer
        </Button>
      {:else}
        <Button variant="ghost" icon="timer" onclick={() => room.send({ type: 'admin.timer', action: 'start' })} data-testid="btn-timer-start">
          Start {view.settings.timerSeconds ? `${Math.round(view.settings.timerSeconds / 60) || 1} min` : '1 min'} timer
        </Button>
      {/if}
    {/if}
  </div>

  {#if task && view.phase === 'revealed'}
    <fieldset class="final">
      <legend>Final estimate for {task.key ?? 'this task'}</legend>
      <div class="picks" role="radiogroup" aria-label="Final estimate">
        {#each estimable as c (c.value)}
          <button
            type="button"
            role="radio"
            class="pick"
            aria-checked={finalChoice === c.value && custom.trim() === ''}
            data-testid="final-value"
            data-value={c.value}
            onclick={() => {
              finalChoice = c.value;
              custom = '';
            }}
          >
            {c.value}
            {#if round?.stats?.suggested === c.value}<span class="sugg">suggested</span>{/if}
          </button>
        {/each}
      </div>
      <div class="final-row">
        <label class="visually-hidden" for="final-custom">Other value</label>
        <input id="final-custom" class="input custom" bind:value={custom} maxlength="16" placeholder="Other value" data-testid="final-custom" />
        <Button variant="primary" icon="flag" onclick={saveFinal} disabled={!finalChoice && custom.trim() === ''} data-testid="btn-final">
          {task.final === null ? 'Save final estimate' : 'Update final estimate'}
        </Button>
      </div>
    </fieldset>
  {/if}
</div>

<style>
  .controls {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-surface-2);
  }

  .primary-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .final {
    border: 0;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }

  legend {
    padding: 0;
    margin-bottom: var(--space-2);
    font-weight: var(--weight-semibold);
  }

  .picks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .pick {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 48px;
    min-height: 48px;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-weight: var(--weight-semibold);
    font-size: var(--text-lg);
    cursor: pointer;
  }

  .pick[aria-checked='true'] {
    border: 2px solid var(--color-accent);
    background: var(--color-accent-soft);
  }

  .sugg {
    font-size: 10px;
    font-weight: var(--weight-medium);
    color: var(--color-text-muted);
  }

  .final-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .custom {
    width: 10rem;
  }
</style>
