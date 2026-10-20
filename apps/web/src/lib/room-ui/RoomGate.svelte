<script lang="ts">
  import Spinner from '../components/Spinner.svelte';
  import { useRoom } from './context.ts';
  import EndedState from './EndedState.svelte';
  import JoinForm from './JoinForm.svelte';

  const room = useRoom();
  const snap = $derived(room.snap);
</script>

{#if snap.status === 'ended' && snap.ended}
  <EndedState reason={snap.ended} joinError={snap.joinError} demo={room.demo} onretry={() => room.retry()} />
{:else if snap.status === 'idle' || (snap.status === 'connecting' && !snap.view && snap.attempt === 0)}
  <JoinForm
    isHost={room.link.adminSecret !== null}
    busy={snap.status === 'connecting'}
    error={snap.joinError}
    demo={room.demo}
    onjoin={(req) => room.join({ ...req, team: room.link.team ?? null }, { askTeam: true })}
  />
{:else if snap.status === 'lobby'}
  <section class="wait panel" data-testid="lobby-waiting" aria-live="polite">
    <Spinner />
    <h1>Waiting for the host</h1>
    <p class="muted">The host lets each person in. This page updates by itself.</p>
  </section>
{:else}
  <section class="wait panel" aria-live="polite">
    <Spinner />
    <h1>Connecting…</h1>
    <p class="muted">Attempt {snap.attempt + 1}. Checking that the server is reachable.</p>
  </section>
{/if}

<style>
  .wait {
    max-width: 480px;
    margin: var(--space-16) auto;
    padding: var(--space-10) var(--space-6);
    text-align: center;
    display: grid;
    justify-items: center;
    gap: var(--space-3);
  }

  h1 {
    font-size: var(--text-2xl);
  }
</style>
