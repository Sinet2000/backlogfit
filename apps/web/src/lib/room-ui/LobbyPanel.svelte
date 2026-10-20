<script lang="ts">
  import Button from '../components/Button.svelte';
  import PanelHeader from '../components/PanelHeader.svelte';
  import { useRoom, viewOf } from './context.ts';

  const room = useRoom();
  const view = $derived(viewOf(room));
</script>

{#if view.lobby.length > 0}
  <section class="lobby" aria-labelledby="lobby-h">
    <PanelHeader id="lobby-h" title="Waiting to join" count={view.lobby.length} />
    <p class="visually-hidden" aria-live="polite">{view.lobby.length} waiting to join</p>
    <ul>
      {#each view.lobby as p (p.id)}
        <li data-testid="lobby-entry" data-name={p.name}>
          <span class="name">{p.name}{#if room.teamName(p.team)} <span class="muted">· {room.teamName(p.team)}</span>{/if}{#if p.role === 'spectator'} <span class="muted">· watching</span>{/if}</span>
          <Button size="sm" variant="ghost" onclick={() => room.admit(p.id, 'deny')} data-testid="lobby-deny" aria-label="Decline {p.name}">
            Decline
          </Button>
          <Button size="sm" variant="primary" onclick={() => room.admit(p.id, 'approve')} data-testid="lobby-approve" aria-label="Let {p.name} in">
            Let in
          </Button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .lobby {
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-lg);
    background: var(--color-warning-soft);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-weight: var(--weight-medium);
  }
</style>
