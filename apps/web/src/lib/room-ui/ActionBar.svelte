<script lang="ts">
  import Button from '../components/Button.svelte';
  import MenuButton, { type MenuItem } from '../components/MenuButton.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import { useRoom, viewOf } from './context.ts';
  import FinalEstimatePicker from './FinalEstimatePicker.svelte';

  const room = useRoom();
  const view = $derived(viewOf(room));
  const task = $derived(room.currentTask);
  const round = $derived(room.currentRound);

  let choice = $state<string | null>(null);
  let custom = $state('');

  $effect(() => {
    if (view.phase === 'revealed') choice = task?.final ?? round?.stats?.suggested ?? null;
  });

  const voters = $derived(room.eligible);
  const voted = $derived(voters.filter((p) => p.hasVoted).length);
  const value = $derived(custom.trim() !== '' ? custom.trim().slice(0, 16) : choice);
  const hasNext = $derived(room.upNextId !== null);
  const timerMin = $derived(Math.max(1, Math.round((view.settings.timerSeconds ?? 60) / 60)));

  const votingMenu = $derived<MenuItem[]>([
    view.timer
      ? {
          label: 'Stop timer',
          icon: 'timer',
          onselect: () => room.stopTimer(),
          testid: 'btn-timer-stop',
        }
      : {
          label: `Start ${timerMin} min timer`,
          icon: 'timer',
          onselect: () => room.startTimer(),
          testid: 'btn-timer-start',
        },
    {
      label: 'Restart round',
      icon: 'refresh',
      onselect: () => room.restartRound(),
      testid: 'btn-revote',
    },
    {
      label: 'Skip this task',
      icon: 'next',
      onselect: () => room.next(),
      testid: 'btn-skip',
      shortcut: 'N',
    },
  ]);

  const revealedMenu = $derived<MenuItem[]>([
    {
      label: 'Save without moving on',
      icon: 'flag',
      onselect: save,
      disabled: !value,
      testid: 'btn-final',
    },
    {
      label: hasNext ? 'Skip without an estimate' : 'Finish without an estimate',
      icon: 'next',
      onselect: () => room.next(),
      testid: 'btn-skip',
      shortcut: 'N',
    },
  ]);

  function save() {
    if (!task || !value) return;
    room.setFinal(task.id, value);
    custom = '';
  }

  function saveAndNext(e: SubmitEvent) {
    e.preventDefault();
    if (!task || !value) return;
    room.saveAndNext(task.id, value);
    custom = '';
  }
</script>

{#if task && view.phase === 'voting'}
  <div class="bar" role="group" aria-label="Host controls">
    <div class="progress">
      <span class="count"><strong>{voted}</strong> of {voters.length} voted</span>
      <ProgressBar value={voted} max={voters.length} />
    </div>
    <div class="buttons">
      <MenuButton label="More actions" items={votingMenu} placement="above" testid="host-menu" />
      <Button variant="primary" icon="eye" onclick={() => room.reveal()} data-testid="btn-reveal" aria-keyshortcuts="Space">
        Reveal votes
      </Button>
    </div>
  </div>
{:else if task && view.phase === 'revealed'}
  <form class="bar revealed" aria-label="Host controls" onsubmit={saveAndNext}>
    <FinalEstimatePicker
      scale={view.config.scale}
      suggested={round?.stats?.suggested ?? null}
      taskLabel={task.key ?? 'this task'}
      bind:choice
      bind:custom
    />
    <div class="buttons end">
      <MenuButton label="More actions" items={revealedMenu} placement="above" testid="host-menu" />
      <Button icon="refresh" onclick={() => room.restartRound()} data-testid="btn-revote">Vote again</Button>
      <Button type="submit" variant="primary" iconAfter="right" disabled={!value} data-testid="btn-save-next">
        {value ? `Save ${value} and ${hasNext ? 'continue' : 'finish'}` : 'Pick a final estimate'}
      </Button>
    </div>
  </form>
{/if}

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin: 0 calc(-1 * var(--space-6)) calc(-1 * var(--space-6));
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--color-border);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    background: var(--color-surface);
  }

  .bar.revealed {
    display: grid;
    justify-content: stretch;
  }

  .progress {
    display: grid;
    gap: var(--space-2);
    flex: 1 1 12rem;
    max-width: 18rem;
  }

  .count {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .count strong {
    color: var(--color-text);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .buttons.end {
    justify-content: flex-end;
  }

  @media (max-width: 640px) {
    .bar {
      position: sticky;
      bottom: 0;
      z-index: 20;
      margin: 0 calc(-1 * var(--space-4)) calc(-1 * var(--space-4));
      padding: var(--space-3) var(--space-4);
      box-shadow: 0 -4px 12px var(--color-shadow);
    }

    .bar.revealed {
      position: static;
      box-shadow: none;
    }

    .buttons {
      flex: 1;
      justify-content: flex-end;
    }
  }
</style>
