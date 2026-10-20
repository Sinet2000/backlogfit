<script lang="ts">
  import Card from '../components/Card.svelte';
  import { useRoom, viewOf } from './context.ts';

  const room = useRoom();
  const view = $derived(viewOf(room));
  const voters = $derived([...room.eligible].sort((a, b) => a.name.localeCompare(b.name)));
  const back = { value: '', label: '', kind: 'number' as const };
</script>

{#if voters.length > 0}
  <ul class="table" aria-label="Who has voted" data-testid="voting-table">
    {#each voters as p (p.id)}
      <li class:waiting={!p.hasVoted} data-voted={p.hasVoted ? 'true' : 'false'}>
        {#if p.hasVoted}
          <Card card={back} faceUp={false} size="sm" />
        {:else}
          <span class="empty" aria-hidden="true"></span>
        {/if}
        <span class="name" title={p.name}>{p.id === view.me?.participantId ? 'You' : p.name}</span>
        <span class="visually-hidden">{p.hasVoted ? 'has voted' : 'has not voted yet'}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .table {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-4);
    list-style: none;
    margin: 0;
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--color-surface-2);
  }

  li {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    width: 72px;
  }

  .empty {
    display: block;
    width: 52px;
    height: 72px;
    border: 1.5px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
  }

  .name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
  }

  .waiting .name {
    color: var(--color-text-muted);
  }

  :global(:root[data-mode='contrast']) .table {
    border: 1px solid var(--color-border);
  }
</style>
