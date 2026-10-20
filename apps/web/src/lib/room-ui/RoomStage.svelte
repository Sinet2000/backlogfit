<script lang="ts">
  import CardDeck from '../components/CardDeck.svelte';
  import Icon from '../components/Icon.svelte';
  import RevealPanel from '../components/RevealPanel.svelte';
  import Timer from '../components/Timer.svelte';
  import { estimatingText } from '../room/format.ts';
  import ActionBar from './ActionBar.svelte';
  import CurrentTask from './CurrentTask.svelte';
  import { useRoom, viewOf } from './context.ts';
  import EmptyStage from './EmptyStage.svelte';
  import VotingTable from './VotingTable.svelte';

  const room = useRoom();
  const view = $derived(viewOf(room));
  const voterTeams = $derived(
    (room.currentTask?.voters ?? []).flatMap((id) => room.teamName(id) ?? []),
  );
  const restricted = $derived(voterTeams.length > 0);
  const nobodyHere = $derived(
    restricted && view.phase === 'voting' && !room.eligible.some((p) => p.connected),
  );
</script>

<section class="stage panel" aria-label="Current task">
  {#if room.currentTask}
    <div class="head">
      <CurrentTask task={room.currentTask} round={view.round} phase={view.phase} by={restricted ? voterTeams.join(', ') : null} />
      {#if view.timer && view.phase === 'voting'}
        <Timer endsAt={view.timer.endsAt} seconds={view.timer.seconds} serverNow={room.serverNow} />
      {/if}
    </div>

    {#if view.phase === 'revealed' && room.currentRound}
      {#key `${view.currentTaskId}:${view.round}`}
        <RevealPanel round={room.currentRound} scale={view.config.scale} teams={room.teams} />
      {/key}
    {:else if view.phase === 'voting'}
      {#if nobodyHere && room.canFacilitate}
        <p class="hint" role="status" data-testid="no-eligible">
          <Icon name="info" size={18} />
          <span>
            <strong>Nobody from {voterTeams.join(' or ')} is here yet.</strong>
            Invite them with their team link, or change who estimates this task in the task list.
          </span>
        </p>
      {/if}
      <VotingTable />
      {#if room.canVote && !room.canEstimateNow}
        <p class="prompt follow" data-testid="not-estimating">
          {estimatingText(voterTeams)} You can follow along.
        </p>
      {:else if room.canVote}
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

  .follow {
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
  }

  .hint {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    font-size: var(--text-sm);
  }

  .hint :global(.icon) {
    flex: none;
    margin-top: 2px;
    color: var(--color-accent);
  }

  @media (max-width: 640px) {
    .stage {
      padding: var(--space-4);
    }
  }
</style>
