<script lang="ts">
import type { RoomView } from '@backlogfit/core';
import Button from '../components/Button.svelte';
import type { RoomStore } from '../room/room.svelte.ts';

let { room, view }: { room: RoomStore; view: RoomView } = $props();
</script>

{#if view.lobby.length > 0}
  <section class="lobby" aria-labelledby="lobby-h">
    <h2 id="lobby-h">Waiting to join <span class="count">{view.lobby.length}</span></h2>
    <p class="visually-hidden" aria-live="polite">{view.lobby.length} waiting to join</p>
    <ul>
      {#each view.lobby as p (p.id)}
        <li data-testid="lobby-entry" data-name={p.name}>
          <span class="name">{p.name}{#if p.role === 'spectator'} <span class="muted">(watching)</span>{/if}</span>
          <Button size="sm" variant="primary" onclick={() => room.send({ type: 'admin.lobby', participantId: p.id, decision: 'approve' })} data-testid="lobby-approve" aria-label="Let {p.name} in">
            Let in
          </Button>
          <Button size="sm" variant="ghost" onclick={() => room.send({ type: 'admin.lobby', participantId: p.id, decision: 'deny' })} data-testid="lobby-deny" aria-label="Decline {p.name}">
            Decline
          </Button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .lobby {
    padding: var(--space-4);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-lg);
    background: var(--color-warning-soft);
  }

  h2 {
    font-size: var(--text-md);
    margin-bottom: var(--space-2);
  }

  .count {
    font-weight: var(--weight-normal);
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
  }
</style>
