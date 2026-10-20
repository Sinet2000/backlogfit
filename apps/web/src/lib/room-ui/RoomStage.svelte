<script lang="ts">
  import CardDeck from '../components/CardDeck.svelte';
  import RevealPanel from '../components/RevealPanel.svelte';
  import Timer from '../components/Timer.svelte';
  import ActionBar from './ActionBar.svelte';
  import CurrentTask from './CurrentTask.svelte';
  import { useRoom, viewOf } from './context.ts';
  import EmptyStage from './EmptyStage.svelte';
  import VotingTable from './VotingTable.svelte';

  const room = useRoom();
  const view = $derived(viewOf(room));
</script>

<section class="stage panel" aria-label="Current task">
  {#if room.currentTask}
    <div class="head">
      <CurrentTask task={room.currentTask} round={view.round} phase={view.phase} />
      {#if view.timer && view.phase === 'voting'}
        <Timer endsAt={view.timer.endsAt} seconds={view.timer.seconds} serverNow={room.serverNow} />
      {/if}
    </div>

    {#if view.phase === 'revealed' && room.currentRound}
      {#key `${view.currentTaskId}:${view.round}`}
        <RevealPanel round={room.currentRound} scale={view.config.scale} />
      {/key}
    {:else if view.phase === 'voting'}
      <VotingTable />
      {#if room.canVote}
        <div class="vote">
          <p class="prompt" aria-live="polite">
            {room.myVote === null ? 'Pick a card. Nobody sees it until the reveal.' : 'Your vote is in. You can change it until the reveal.'}
          </p>
          <CardDeck cards={view.config.scale} selected={room.myVote} onpick={(v) => room.vote(v)} />
        </div>
      {:else}
        <p class="prompt muted">You are watching. Votes appear when the host reveals them.</p>
      {/if}
    {/if}
  {:else}
    <EmptyStage />
  {/if}

  {#if room.canFacilitate}
    <ActionBar />
  {/if}
</section>

<style>
  .stage {
    display: grid;
    gap: var(--space-6);
    grid-template-columns: minmax(0, 1fr);
    padding: var(--space-6);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .head > :global(.current) {
    flex: 1 1 16rem;
    min-width: 0;
  }

  .vote {
    display: grid;
    gap: var(--space-3);
  }

  .prompt {
    text-align: center;
  }

  @media (max-width: 640px) {
    .stage {
      padding: var(--space-4);
    }
  }
</style>
